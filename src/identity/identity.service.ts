import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class IdentityService {
  private readonly SECRET_KEY = process.env.QR_SECRET || 'UECG_SECRET_2026_BOLIVIA';

  constructor(
    private prisma: PrismaService,
    @InjectQueue('export-queue') private exportQueue: Queue, // Reutilizamos tu cola existente
  ) {}

  // 🔥 Firmamos usando el ID y la VERSIÓN actual
  generateSignedToken(studentId: string, version: number): string {
    const payload = `${studentId}:${version}`;
    const hash = crypto
      .createHmac('sha256', this.SECRET_KEY)
      .update(payload)
      .digest('hex')
      .slice(0, 10);
    return `${payload}:${hash}`;
  }

  async generateQRCode(studentId: string): Promise<string> {
    // 1. Buscamos al estudiante para saber su versión actual
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    try {
      const signedToken = this.generateSignedToken(student.id, student.qrTokenVersion);
      return await QRCode.toDataURL(signedToken, {
        errorCorrectionLevel: 'H', // Nivel Alto (H) para soportar daños físicos en el carnet
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
    } catch (err) {
      throw new InternalServerErrorException('Error al generar el QR');
    }
  }

  

  // 🔥 NUEVO: Envía el trabajo al Worker
  async requestMassiveCarnets(academicYearId: string, filters: { level?: any; classroomId?: string }) {
    await this.exportQueue.add('generate-massive-carnets', { academicYearId, ...filters });
    return { 
      message: 'Generación de carnets iniciada en segundo plano.', 
      status: 'processing' 
    };
  }


  async validateQrToken(scannedToken: string): Promise<string> {
    const [studentId, versionStr, hash] = scannedToken.split(':');
    
    if (!studentId || !versionStr || !hash) {
      throw new InternalServerErrorException('Formato de QR inválido');
    }

    // 1. Verificamos la firma criptográfica
    const payload = `${studentId}:${versionStr}`;
    const expectedHash = crypto
      .createHmac('sha256', this.SECRET_KEY)
      .update(payload)
      .digest('hex')
      .slice(0, 10);

    if (hash !== expectedHash) {
      throw new InternalServerErrorException('Firma de QR adulterada (Posible Fraude)');
    }

    // 2. Verificamos que la versión no haya sido revocada
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { qrTokenVersion: true }
    });

    if (!student) throw new NotFoundException('Estudiante no encontrado');
    
    if (student.qrTokenVersion !== parseInt(versionStr, 10)) {
      throw new InternalServerErrorException('Este Carnet ha sido REVOCADO. Retenga el carnet.');
    }

    return studentId;
  }

  async getStudentQR(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    if (!student.hasActiveQr) {
      return { isActive: false, qr: null }; // El frontend sabrá que debe mostrar el botón "Generar"
    }

    try {
      const signedToken = this.generateSignedToken(student.id, student.qrTokenVersion);
      const qr = await QRCode.toDataURL(signedToken, {
        errorCorrectionLevel: 'H',
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      return { isActive: true, qr };
    } catch (err) {
      throw new InternalServerErrorException('Error al generar el QR');
    }
  }

  // 🔥 NUEVO: Método para crear/activar el carnet por primera vez (o tras una revocación)
  async generateNewQR(studentId: string) {
    const student = await this.prisma.student.update({
      where: { id: studentId },
      data: { hasActiveQr: true }, // Encendemos la bandera
    });

    const signedToken = this.generateSignedToken(student.id, student.qrTokenVersion);
    const qr = await QRCode.toDataURL(signedToken, {
      errorCorrectionLevel: 'H', margin: 1, color: { dark: '#000000', light: '#FFFFFF' },
    });
    
    return { message: 'Carnet activado y generado exitosamente', isActive: true, qr };
  }

  // 🔥 ACTUALIZADO: Revoca la versión Y apaga la bandera
  async revokeQR(studentId: string) {
    await this.prisma.student.update({
      where: { id: studentId },
      data: { 
        qrTokenVersion: { increment: 1 },
        hasActiveQr: false // 🔥 Lo apagamos, forzando a que se tenga que volver a generar
      },
    });
    return { message: 'Carnet revocado. El estudiante no podrá ingresar hasta emitir uno nuevo.' };
  }
  
}
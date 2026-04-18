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

  // 🔥 NUEVO: Revoca el carnet subiendo la versión en DB
  async revokeQR(studentId: string) {
    const student = await this.prisma.student.update({
      where: { id: studentId },
      data: { qrTokenVersion: { increment: 1 } },
    });
    return { 
      message: 'Carnet anterior revocado exitosamente. Nueva firma criptográfica generada.', 
      newVersion: student.qrTokenVersion 
    };
  }

  // 🔥 NUEVO: Envía el trabajo al Worker
  async requestMassiveCarnets(academicYearId: string, filters: { level?: any; classroomId?: string }) {
    await this.exportQueue.add('generate-massive-carnets', { academicYearId, ...filters });
    return { 
      message: 'Generación de carnets iniciada en segundo plano.', 
      status: 'processing' 
    };
  }
}
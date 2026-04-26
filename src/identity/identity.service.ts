import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class IdentityService {
  private readonly SECRET_KEY =
    process.env.QR_SECRET || 'UECG_SECRET_2026_BOLIVIA';

  constructor(
    private prisma: PrismaService,
    @InjectQueue('export-queue') private exportQueue: Queue,
  ) {}

  generateSignedToken(studentId: string, version: number): string {
    const payload = `${studentId}:${version}`;
    const hash = crypto
      .createHmac('sha256', this.SECRET_KEY)
      .update(payload)
      .digest('hex')
      .slice(0, 10);
    return `${payload}:${hash}`;
  }

  async getStudentQR(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    if (!student.hasActiveQr) return { isActive: false, qr: null };

    try {
      const signedToken = this.generateSignedToken(
        student.id,
        student.qrTokenVersion,
      );
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

  async generateNewQR(studentId: string) {
    const student = await this.prisma.student.update({
      where: { id: studentId },
      data: { hasActiveQr: true },
    });
    const signedToken = this.generateSignedToken(
      student.id,
      student.qrTokenVersion,
    );
    const qr = await QRCode.toDataURL(signedToken, {
      errorCorrectionLevel: 'H',
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    return {
      message: 'Carnet activado y generado exitosamente',
      isActive: true,
      qr,
    };
  }

  async revokeQR(studentId: string) {
    await this.prisma.student.update({
      where: { id: studentId },
      data: { qrTokenVersion: { increment: 1 }, hasActiveQr: false },
    });
    return {
      message:
        'Carnet revocado. El estudiante no podrá ingresar hasta emitir uno nuevo.',
    };
  }

  async requestMassiveCarnets(
    academicYearId: string,
    filters: { level?: any; classroomId?: string },
  ) {
    await this.exportQueue.add('generate-massive-carnets', {
      academicYearId,
      ...filters,
    });
    return {
      message: 'Generación de carnets iniciada en segundo plano.',
      status: 'processing',
    };
  }

  async validateQrToken(scannedToken: string): Promise<string> {
    const [studentId, versionStr, hash] = scannedToken.split(':');
    if (!studentId || !versionStr || !hash)
      throw new InternalServerErrorException('Formato de QR inválido');

    const payload = `${studentId}:${versionStr}`;
    const expectedHash = crypto
      .createHmac('sha256', this.SECRET_KEY)
      .update(payload)
      .digest('hex')
      .slice(0, 10);
    if (hash !== expectedHash)
      throw new InternalServerErrorException(
        'Firma de QR adulterada (Posible Fraude)',
      );

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { qrTokenVersion: true, hasActiveQr: true },
    });

    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (
      !student.hasActiveQr ||
      student.qrTokenVersion !== parseInt(versionStr, 10)
    ) {
      throw new InternalServerErrorException(
        'Este Carnet ha sido REVOCADO o está INACTIVO. Retenga el carnet.',
      );
    }

    return studentId;
  }
}

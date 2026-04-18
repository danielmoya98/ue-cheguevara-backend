import { Injectable, NotFoundException, BadRequestException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { RegisterAttendanceDto } from './dto/register-attendance.dto';
import { AttendanceStatus, AttendanceMethod } from '../../prisma/generated/client';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private identityService: IdentityService,
  ) {}

  async registerScan(dto: RegisterAttendanceDto, teacherId: string) {
    // 1. Validar el QR y extraer el ID del estudiante (Blindaje de seguridad)
    const studentId = await this.identityService.validateQrToken(dto.qrToken);

    // 2. Buscar la inscripción activa del estudiante en la gestión actual
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        status: 'INSCRITO',
        academicYear: { status: 'ACTIVE' },
      },
      include: { student: true },
    });

    if (!enrollment) throw new BadRequestException('El estudiante no tiene una inscripción activa.');

    // 3. Obtener el Periodo de Clase y las Reglas de la Institución
    const [classPeriod, institution] = await Promise.all([
      this.prisma.classPeriod.findUnique({ where: { id: dto.classPeriodId } }),
      this.prisma.institution.findFirst(),
    ]);

    if (!classPeriod) throw new NotFoundException('Periodo de clase no encontrado.');
    if (!institution) throw new InternalServerErrorException('Reglas de institución no configuradas.');

    // 4. Time Matcher: Calcular si es Presente, Atraso o Falta
    const status = this.calculateAttendanceStatus(
      classPeriod.startTime,
      institution.lateToleranceMinutes,
      institution.absentToleranceMinutes,
    );

    // 5. El Timestamp exacto y la Fecha pura (para agrupar en DB)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // "2026-04-18"
    const dateOnly = new Date(todayStr); // Fecha a las 00:00:00

    // 6. Guardar en Base de Datos (Con protección Anti-Spam / Idempotencia)
    try {
      await this.prisma.attendanceRecord.create({
        data: {
          enrollmentId: enrollment.id,
          classPeriodId: classPeriod.id,
          date: dateOnly,
          status: status,
          method: dto.method || AttendanceMethod.QR,
          timestamp: now,
          markedById: teacherId,
        },
      });
    } catch (error) {
      // P2002 = Violación de Unique Constraint (Ya escaneó en esta clase hoy)
      if (error.code === 'P2002') {
        this.logger.warn(`Escaneo duplicado ignorado para ${enrollment.student.names}`);
        // Retornamos 200 OK igual para que el escáner no muestre error rojo al profesor
        return this.buildScannerResponse(enrollment.student, status, 'Ya Registrado');
      }
      throw error;
    }

    // 7. (Opcional Futuro): Aquí dispararíamos la notificación Push a la App de Padres con BullMQ

    return this.buildScannerResponse(enrollment.student, status, 'Asistencia Exitosa');
  }

  // ==========================================
  // MÉTODOS PRIVADOS DE AYUDA
  // ==========================================

  private calculateAttendanceStatus(startTimeStr: string, lateTol: number, absentTol: number): AttendanceStatus {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // startTimeStr es "08:00"
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const startTotalMinutes = startH * 60 + startM;

    const diffMinutes = currentMinutes - startTotalMinutes;

    if (diffMinutes > absentTol) return AttendanceStatus.ABSENT;
    if (diffMinutes > lateTol) return AttendanceStatus.LATE;
    return AttendanceStatus.PRESENT;
  }

  private buildScannerResponse(student: any, status: AttendanceStatus, message: string) {
    // Formateamos el nombre: "Daniel Moya"
    const firstName = student.names.split(' ')[0];
    const lastName = student.lastNamePaterno || '';
    
    return {
      success: true,
      message,
      data: {
        studentName: `${firstName} ${lastName}`.trim(),
        status,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
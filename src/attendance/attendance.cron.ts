import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttendanceStatus,
  AttendanceMethod,
  Shift,
} from '../../prisma/generated/client';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(private prisma: PrismaService) {}

  @Cron('0 14 * * 1-5')
  async handleMorningClosing() {
    await this.processAttendanceClosing(Shift.MANANA);
  }

  @Cron('0 20 * * 1-5')
  async handleAfternoonClosing() {
    await this.processAttendanceClosing(Shift.TARDE);
  }

  private async processAttendanceClosing(shift: Shift) {
    // 🔥 1. SALVAVIDAS: Verificar si hay un trimestre abierto hoy
    const activeTrimester = await this.prisma.trimester.findFirst({
      where: {
        isOpen: true,
        academicYear: { status: 'ACTIVE' },
      },
    });

    if (!activeTrimester) {
      this.logger.log(
        `[CRON ${shift}] Cancelado. No hay trimestres abiertos (Posibles vacaciones).`,
      );
      return; // Cortamos la ejecución, salvando miles de registros falsos.
    }

    const today = new Date();
    const dateOnly = new Date(today.toISOString().split('T')[0]);

    try {
      const activeEnrollments = await this.prisma.enrollment.findMany({
        where: {
          status: 'INSCRITO',
          academicYear: { status: 'ACTIVE' },
          classroom: { shift: shift },
        },
        select: { id: true },
      });

      if (activeEnrollments.length === 0) return;

      const firstPeriod = await this.prisma.classPeriod.findFirst({
        where: { shift: shift, isBreak: false },
        orderBy: { order: 'asc' },
      });

      if (!firstPeriod) return;

      const existingRecords = await this.prisma.attendanceRecord.findMany({
        where: { date: dateOnly, classPeriodId: firstPeriod.id },
        select: { enrollmentId: true },
      });

      const presentEnrollmentIds = new Set(
        existingRecords.map((r) => r.enrollmentId),
      );
      const absentEnrollments = activeEnrollments.filter(
        (e) => !presentEnrollmentIds.has(e.id),
      );

      if (absentEnrollments.length === 0) return;

      const missingRecordsData = absentEnrollments.map((enrollment) => ({
        enrollmentId: enrollment.id,
        classPeriodId: firstPeriod.id,
        date: dateOnly,
        status: AttendanceStatus.ABSENT,
        method: AttendanceMethod.SYSTEM_AUTO,
        timestamp: new Date(),
        markedById: null,
      }));

      const result = await this.prisma.attendanceRecord.createMany({
        data: missingRecordsData,
        skipDuplicates: true,
      });

      this.logger.log(
        `Cierre completado (${shift}): ${result.count} faltas automáticas (ABSENT).`,
      );
    } catch (error) {
      this.logger.error(
        `Error durante el cierre de asistencia (${shift})`,
        error,
      );
    }
  }
}

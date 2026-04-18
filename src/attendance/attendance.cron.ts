import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, AttendanceMethod, Shift } from '../../prisma/generated/client';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(private prisma: PrismaService) {}

  // 🔥 Se ejecuta a las 14:00 hrs (Para el Turno Mañana)
  @Cron('0 14 * * 1-5')
  async handleMorningClosing() {
    this.logger.log('Iniciando cierre automático de asistencia (Turno Mañana)...');
    await this.processAttendanceClosing(Shift.MANANA);
  }

  // 🔥 Se ejecuta a las 20:00 hrs (Para el Turno Tarde)
  @Cron('0 20 * * 1-5')
  async handleAfternoonClosing() {
    this.logger.log('Iniciando cierre automático de asistencia (Turno Tarde)...');
    await this.processAttendanceClosing(Shift.TARDE);
  }

  // ====================================================================
  // MOTOR CENTRAL DINÁMICO POR TURNO
  // ====================================================================
  private async processAttendanceClosing(shift: Shift) {
    const today = new Date();
    const dateOnly = new Date(today.toISOString().split('T')[0]); // Fecha a las 00:00:00

    try {
      // 1. Obtener alumnos inscritos SÓLO de cursos de este turno
      const activeEnrollments = await this.prisma.enrollment.findMany({
        where: { 
          status: 'INSCRITO',
          academicYear: { status: 'ACTIVE' },
          classroom: { shift: shift } // 🔥 Filtro vital de turno
        },
        select: { id: true }
      });

      if (activeEnrollments.length === 0) {
        this.logger.log(`No hay alumnos activos en el turno ${shift}. Omitiendo.`);
        return;
      }

      // 2. Obtener la 1ra Hora real de este turno (Ignorando recreos)
      const firstPeriod = await this.prisma.classPeriod.findFirst({
        where: { shift: shift, isBreak: false },
        orderBy: { order: 'asc' } // Usamos 'order' para máxima precisión
      });

      if (!firstPeriod) {
        this.logger.warn(`No hay periodos configurados para el turno ${shift}. Abortando.`);
        return;
      }

      // 3. Buscar quiénes SÍ vinieron hoy a esa 1ra hora
      const existingRecords = await this.prisma.attendanceRecord.findMany({
        where: {
          date: dateOnly,
          classPeriodId: firstPeriod.id
        },
        select: { enrollmentId: true }
      });

      const presentEnrollmentIds = new Set(existingRecords.map(r => r.enrollmentId));

      // 4. Filtrar a los ausentes
      const absentEnrollments = activeEnrollments.filter(
        enrollment => !presentEnrollmentIds.has(enrollment.id)
      );

      if (absentEnrollments.length === 0) {
        this.logger.log(`Cierre perfecto (${shift}): Todos tienen registro hoy.`);
        return;
      }

      // 5. Inserción Masiva
      const missingRecordsData = absentEnrollments.map(enrollment => ({
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

      this.logger.log(`Cierre completado (${shift}): Se registraron ${result.count} faltas automáticas (ABSENT).`);

    } catch (error) {
      this.logger.error(`Error durante el cierre de asistencia (${shift})`, error);
    }
  }
}
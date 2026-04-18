import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, AttendanceMethod } from '../../prisma/generated/client';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(private prisma: PrismaService) {}

  // 🔥 Se ejecuta de Lunes a Viernes a las 14:00 hrs
  @Cron('0 14 * * 1-5')
  async handleDailyAttendanceClosing() {
    this.logger.log('Iniciando cierre automático de asistencia diaria...');
    
    const today = new Date();
    const dateOnly = new Date(today.toISOString().split('T')[0]); // Fecha a las 00:00:00

    try {
      // 1. Obtener todas las inscripciones activas (Alumnos oficiales)
      const activeEnrollments = await this.prisma.enrollment.findMany({
        where: { 
          status: 'INSCRITO',
          academicYear: { status: 'ACTIVE' }
        },
        select: { id: true, classroomId: true, student: { select: { names: true } } }
      });

      // 2. Obtener el primer periodo del día (Ej: 1ra Hora / Ingreso)
      // Asumimos que la falta general del día se marca en el primer periodo.
      const firstPeriod = await this.prisma.classPeriod.findFirst({
        orderBy: { startTime: 'asc' }
      });

      if (!firstPeriod) {
        this.logger.warn('No hay periodos de clase configurados. Abortando CronJob.');
        return;
      }

      // 3. Obtener todos los registros de asistencia que YA existen hoy para ese periodo
      const existingRecords = await this.prisma.attendanceRecord.findMany({
        where: {
          date: dateOnly,
          classPeriodId: firstPeriod.id
        },
        select: { enrollmentId: true }
      });

      // Creamos un Set (conjunto) para búsquedas ultra-rápidas
      const presentEnrollmentIds = new Set(existingRecords.map(r => r.enrollmentId));

      // 4. Filtrar: ¿Quién NO está en el Set de los que sí vinieron?
      const absentEnrollments = activeEnrollments.filter(
        enrollment => !presentEnrollmentIds.has(enrollment.id)
      );

      if (absentEnrollments.length === 0) {
        this.logger.log('Cierre perfecto: Todos los alumnos tienen registro hoy.');
        return;
      }

      // 5. El Hacha: Preparar la inserción masiva (Bulk Insert) de Faltas
      const missingRecordsData = absentEnrollments.map(enrollment => ({
        enrollmentId: enrollment.id,
        classPeriodId: firstPeriod.id,
        date: dateOnly,
        status: AttendanceStatus.ABSENT,
        method: AttendanceMethod.SYSTEM_AUTO, // 🔥 Marcamos que fue un robot, no un humano
        timestamp: new Date(),
        markedById: null, // No fue un profesor
      }));

      // 6. Ejecutar inserción en la Base de Datos
      const result = await this.prisma.attendanceRecord.createMany({
        data: missingRecordsData,
        skipDuplicates: true, // Si por algún milisegundo se cruza un dato, no explota
      });

      this.logger.log(`Cierre completado: Se registraron ${result.count} faltas automáticas (ABSENT).`);

      // (Futuro) Aquí podrías disparar un evento para que BullMQ envíe un 
      // Push Notification al celular de los padres diciendo: "Su hijo no asistió hoy".

    } catch (error) {
      this.logger.error('Error durante el cierre de asistencia', error);
    }
  }
}
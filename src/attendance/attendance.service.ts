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

 
  // ==========================================
  // 🔥 MONITOR EN VIVO (Admin y Docentes)
  // ==========================================
  
  async getDailyMonitor(dto: { classroomId: string, classPeriodId: string, date?: string }) {
    // 🎤 1. LOG DE DEPURACIÓN: ¿Qué ID nos pide el frontend?
    console.log(`🔍 [MONITOR] Frontend solicita ver el curso ID: ${dto.classroomId}`);

    // 1. Resolver la fecha (Si no envían, es hoy)
    const targetDate = dto.date ? new Date(dto.date) : new Date();
    const dateOnly = new Date(targetDate.toISOString().split('T')[0]);

    // 2. Traer a TODOS los alumnos inscritos en ese curso
    const enrollments = await this.prisma.enrollment.findMany({
      where: { 
        classroomId: dto.classroomId, 
        status: 'INSCRITO' 
      },
      include: { student: true }
    });

    // 🎤 2. LOG DE DEPURACIÓN: ¿Cuántos encontró Prisma?
    console.log(`✅ [MONITOR] Prisma encontró ${enrollments.length} alumnos inscritos para ese ID.`);

    // 🛡️ Si no hay alumnos, devolvemos la estructura completa pero en ceros
    if (enrollments.length === 0) {
      return { 
        data: [], 
        summary: { total: 0, present: 0, late: 0, absent: 0, pending: 0 },
        message: 'No hay alumnos inscritos en este curso.' 
      };
    }

    // 3. Traer los registros de asistencia que YA EXISTEN para esa hora y día
    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        classPeriodId: dto.classPeriodId,
        date: dateOnly,
        enrollmentId: { in: enrollments.map(e => e.id) } // Filtramos solo a los de este curso
      }
    });

    // 4. Fusionar los datos: El alumno + Su Estado (Si no escaneó, es PENDING)
    const monitorData = enrollments.map(enrollment => {
      const record = attendanceRecords.find(r => r.enrollmentId === enrollment.id);
      
      const firstName = enrollment.student.names.split(' ')[0];
      const lastName = enrollment.student.lastNamePaterno || '';

      return {
        enrollmentId: enrollment.id,
        studentId: enrollment.student.id,
        fullName: `${lastName} ${enrollment.student.lastNameMaterno || ''} ${firstName}`.trim(),
        // Si hay registro, devolvemos el estado. Si no, devolvemos 'PENDING' (Falta escanear)
        status: record ? record.status : 'PENDING', 
        method: record ? record.method : null,
        timestamp: record ? record.timestamp : null,
      };
    });

    // Ordenar alfabéticamente por apellido
    monitorData.sort((a, b) => a.fullName.localeCompare(b.fullName));

    return {
      data: monitorData,
      summary: {
        total: monitorData.length,
        present: monitorData.filter(m => m.status === AttendanceStatus.PRESENT).length,
        late: monitorData.filter(m => m.status === AttendanceStatus.LATE).length,
        absent: monitorData.filter(m => m.status === AttendanceStatus.ABSENT).length,
        pending: monitorData.filter(m => m.status === 'PENDING').length,
      }
    };
  }

  // ==========================================
  // 🛠️ EL PLAN B: MARCADO MANUAL (Upsert)
  // ==========================================

  async markManualAttendance(dto: import('./dto/manual-attendance.dto').ManualAttendanceDto, teacherId: string) {
    const now = new Date();
    const dateOnly = new Date(now.toISOString().split('T')[0]);

    // Usamos UPSERT: Si ya tenía asistencia (ej. pasó su QR pero la máquina se equivocó), lo actualizamos.
    // Si no tenía, lo creamos.
    const record = await this.prisma.attendanceRecord.upsert({
      where: {
        enrollmentId_classPeriodId_date: {
          enrollmentId: dto.enrollmentId,
          classPeriodId: dto.classPeriodId,
          date: dateOnly,
        }
      },
      update: {
        status: dto.status,
        method: AttendanceMethod.MANUAL,
        markedById: teacherId,
        timestamp: now,
      },
      create: {
        enrollmentId: dto.enrollmentId,
        classPeriodId: dto.classPeriodId,
        date: dateOnly,
        status: dto.status,
        method: AttendanceMethod.MANUAL,
        markedById: teacherId,
        timestamp: now,
      }
    });

    return { data: record, message: `Asistencia marcada como ${dto.status}` };
  }

  // ==========================================
  // 🏥 MÓDULO DE LICENCIAS Y JUSTIFICACIONES
  // ==========================================

  // 1. Buscar historial de "conflictos" (Faltas/Atrasos) de un alumno
  async getStudentAttendanceHistory(enrollmentId: string) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        enrollmentId,
        status: { in: [AttendanceStatus.ABSENT, AttendanceStatus.LATE] }
      },
      include: {
        classPeriod: { select: { name: true, startTime: true } },
      },
      orderBy: { date: 'desc' }
    });
  }

  // 2. Justificar una falta existente o crear una licencia nueva
  async justifyAttendance(recordId: string, justification: string, adminId: string) {
    const record = await this.prisma.attendanceRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('El registro de asistencia no existe.');

    return this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        status: AttendanceStatus.EXCUSED,
        justification: justification,
        markedById: adminId, // Guardamos quién autorizó
        method: AttendanceMethod.MANUAL,
        updatedAt: new Date()
      }
    });
  }

  // 3. Licencia Anticipada (Ej: El alumno avisa que no vendrá mañana)
  async createPreemptiveExcuse(dto: { enrollmentId: string, classPeriodId: string, date: string, reason: string }, adminId: string) {
    const dateOnly = new Date(dto.date);
    
    return this.prisma.attendanceRecord.upsert({
      where: {
        enrollmentId_classPeriodId_date: {
          enrollmentId: dto.enrollmentId,
          classPeriodId: dto.classPeriodId,
          date: dateOnly
        }
      },
      update: {
        status: AttendanceStatus.EXCUSED,
        justification: dto.reason,
        markedById: adminId
      },
      create: {
        enrollmentId: dto.enrollmentId,
        classPeriodId: dto.classPeriodId,
        date: dateOnly,
        status: AttendanceStatus.EXCUSED,
        justification: dto.reason,
        markedById: adminId,
        method: AttendanceMethod.MANUAL
      }
    });
  }
  
}
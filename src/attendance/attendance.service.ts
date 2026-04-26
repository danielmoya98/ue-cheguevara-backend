import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { RegisterAttendanceDto } from './dto/register-attendance.dto';
import {
  AttendanceStatus,
  AttendanceMethod,
  NotificationFrequency,
} from '../../prisma/generated/client';
// 🔥 IMPORTAMOS EL SERVICIO DE FIREBASE Y PERMISOS
import { FirebaseService } from '../firebase/firebase.service';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private identityService: IdentityService,
    private firebaseService: FirebaseService,
  ) {}

  // ==========================================
  // HELPER: VALIDAR SI HAY CLASES HOY (Trimestres)
  // ==========================================
  private async ensureActiveTrimesterExists() {
    const activeTrimester = await this.prisma.trimester.findFirst({
      where: {
        isOpen: true,
        academicYear: { status: 'ACTIVE' },
      },
    });
    if (!activeTrimester) {
      throw new BadRequestException(
        'El sistema de asistencia está bloqueado. No hay ningún trimestre abierto actualmente (Posibles vacaciones o fin de gestión).',
      );
    }
    return activeTrimester;
  }

  // ==========================================
  // HELPER: ABAC - VERIFICAR PROPIEDAD DEL CURSO
  // ==========================================
  private async verifyTeacherClassroomAccess(user: any, classroomId: string) {
    // Si tiene el permiso supremo, pasa libre (Director/Admin)
    if (user.permissions.includes(SystemPermissions.MANAGE_ALL)) return;

    // Si es docente, verificamos que dicte alguna materia en este curso
    const isAssigned = await this.prisma.teacherAssignment.findFirst({
      where: { classroomId: classroomId, teacherId: user.userId },
    });

    if (!isAssigned) {
      throw new ForbiddenException(
        'No tienes carga horaria asignada a este curso. Acceso denegado.',
      );
    }
  }

  // ==========================================
  // REGISTRO QR
  // ==========================================
  async registerScan(dto: RegisterAttendanceDto, user: any) {
    // 1. Bloqueo de vacaciones
    await this.ensureActiveTrimesterExists();

    // 2. Validar el QR y extraer el ID del estudiante
    const studentId = await this.identityService.validateQrToken(dto.qrToken);

    // 3. Buscar la inscripción activa
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        status: 'INSCRITO',
        academicYear: { status: 'ACTIVE' },
      },
      include: { student: true },
    });

    if (!enrollment)
      throw new BadRequestException(
        'El estudiante no tiene una inscripción activa.',
      );

    // 🔥 ABAC Opcional: Podrías bloquear el escaneo si el profe no es del curso.
    // Usualmente en colegios cualquier profe puede escanear un QR en la puerta,
    // pero si quieres ser estricto, descomenta la siguiente línea:
    // await this.verifyTeacherClassroomAccess(user, enrollment.classroomId);

    // 4. Obtener Periodo y Reglas
    const [classPeriod, institution] = await Promise.all([
      this.prisma.classPeriod.findUnique({ where: { id: dto.classPeriodId } }),
      this.prisma.institution.findFirst(),
    ]);

    if (!classPeriod)
      throw new NotFoundException('Periodo de clase no encontrado.');
    if (!institution)
      throw new InternalServerErrorException(
        'Reglas de institución no configuradas.',
      );

    const status = this.calculateAttendanceStatus(
      classPeriod.startTime,
      institution.lateToleranceMinutes,
      institution.absentToleranceMinutes,
    );

    const now = new Date();
    const dateOnly = new Date(now.toISOString().split('T')[0]);

    // 5. Guardar en Base de Datos
    try {
      await this.prisma.attendanceRecord.create({
        data: {
          enrollmentId: enrollment.id,
          classPeriodId: classPeriod.id,
          date: dateOnly,
          status: status,
          method: dto.method || AttendanceMethod.QR,
          timestamp: now,
          markedById: user.userId, // 🔥 Obtenido del JWT
        },
      });

      // 6. Notificación Push Asíncrona
      this.processSmartNotification(
        enrollment.id,
        status,
        now,
        institution,
      ).catch((e) =>
        this.logger.error('Error enviando Push de asistencia QR', e),
      );
    } catch (error) {
      if (error.code === 'P2002') {
        this.logger.warn(
          `Escaneo duplicado ignorado para ${enrollment.student.names}`,
        );
        return this.buildScannerResponse(
          enrollment.student,
          status,
          'Ya Registrado',
        );
      }
      throw error;
    }

    return this.buildScannerResponse(
      enrollment.student,
      status,
      'Asistencia Exitosa',
    );
  }

  // ==========================================
  // 🔥 MONITOR EN VIVO (Admin y Docentes)
  // ==========================================
  async getDailyMonitor(
    dto: { classroomId: string; classPeriodId: string; date?: string },
    user: any,
  ) {
    // 🔥 ABAC: Verifica que el profesor sea dueño del curso que intenta mirar
    await this.verifyTeacherClassroomAccess(user, dto.classroomId);

    const targetDate = dto.date ? new Date(dto.date) : new Date();
    const dateOnly = new Date(targetDate.toISOString().split('T')[0]);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classroomId: dto.classroomId, status: 'INSCRITO' },
      include: { student: true },
    });

    if (enrollments.length === 0) {
      return {
        data: [],
        summary: { total: 0, present: 0, late: 0, absent: 0, pending: 0 },
        message: 'No hay alumnos inscritos en este curso.',
      };
    }

    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        classPeriodId: dto.classPeriodId,
        date: dateOnly,
        enrollmentId: { in: enrollments.map((e) => e.id) },
      },
    });

    const monitorData = enrollments.map((enrollment) => {
      const record = attendanceRecords.find(
        (r) => r.enrollmentId === enrollment.id,
      );
      const firstName = enrollment.student.names.split(' ')[0];
      const lastName = enrollment.student.lastNamePaterno || '';

      return {
        enrollmentId: enrollment.id,
        studentId: enrollment.student.id,
        fullName:
          `${lastName} ${enrollment.student.lastNameMaterno || ''} ${firstName}`.trim(),
        status: record ? record.status : 'PENDING',
        method: record ? record.method : null,
        timestamp: record ? record.timestamp : null,
      };
    });

    monitorData.sort((a, b) => a.fullName.localeCompare(b.fullName));

    return {
      data: monitorData,
      summary: {
        total: monitorData.length,
        present: monitorData.filter(
          (m) => m.status === AttendanceStatus.PRESENT,
        ).length,
        late: monitorData.filter((m) => m.status === AttendanceStatus.LATE)
          .length,
        absent: monitorData.filter((m) => m.status === AttendanceStatus.ABSENT)
          .length,
        pending: monitorData.filter((m) => m.status === 'PENDING').length,
      },
    };
  }

  // ==========================================
  // 🛠️ EL PLAN B: MARCADO MANUAL (Upsert)
  // ==========================================
  async markManualAttendance(
    dto: import('./dto/manual-attendance.dto').ManualAttendanceDto,
    user: any,
  ) {
    // 1. Bloqueo de vacaciones
    await this.ensureActiveTrimesterExists();

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: dto.enrollmentId },
    });
    if (!enrollment) throw new NotFoundException('Inscripción no encontrada');

    // 🔥 ABAC: Verifica que el profesor dicte clases en el curso de este alumno
    await this.verifyTeacherClassroomAccess(user, enrollment.classroomId);

    const now = new Date();
    const dateOnly = new Date(now.toISOString().split('T')[0]);

    const institution = await this.prisma.institution.findFirst();
    if (!institution)
      throw new InternalServerErrorException(
        'Reglas de institución no configuradas.',
      );

    const record = await this.prisma.attendanceRecord.upsert({
      where: {
        enrollmentId_classPeriodId_date: {
          enrollmentId: dto.enrollmentId,
          classPeriodId: dto.classPeriodId,
          date: dateOnly,
        },
      },
      update: {
        status: dto.status,
        method: AttendanceMethod.MANUAL,
        markedById: user.userId, // 🔥 JWT
        timestamp: now,
      },
      create: {
        enrollmentId: dto.enrollmentId,
        classPeriodId: dto.classPeriodId,
        date: dateOnly,
        status: dto.status,
        method: AttendanceMethod.MANUAL,
        markedById: user.userId, // 🔥 JWT
        timestamp: now,
      },
    });

    this.processSmartNotification(
      dto.enrollmentId,
      dto.status,
      now,
      institution,
    ).catch((e) =>
      this.logger.error('Error enviando Push de asistencia Manual', e),
    );

    return { data: record, message: `Asistencia marcada como ${dto.status}` };
  }

  // ==========================================
  // 🏥 MÓDULO DE LICENCIAS Y JUSTIFICACIONES
  // ==========================================
  async getStudentAttendanceHistory(enrollmentId: string, user: any) {
    // Nota: Podrías inyectar ABAC aquí para que el docente solo vea historial de sus alumnos,
    // pero el historial suele ser de lectura amplia.
    return this.prisma.attendanceRecord.findMany({
      where: {
        enrollmentId,
        status: { in: [AttendanceStatus.ABSENT, AttendanceStatus.LATE] },
      },
      include: {
        classPeriod: { select: { name: true, startTime: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async justifyAttendance(recordId: string, justification: string, user: any) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
    });
    if (!record)
      throw new NotFoundException('El registro de asistencia no existe.');

    return this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        status: AttendanceStatus.EXCUSED,
        justification: justification,
        markedById: user.userId, // 🔥 JWT
        method: AttendanceMethod.MANUAL,
        updatedAt: new Date(),
      },
    });
  }

  async createPreemptiveExcuse(
    dto: {
      enrollmentId: string;
      classPeriodId: string;
      date: string;
      reason: string;
    },
    user: any,
  ) {
    const dateOnly = new Date(dto.date);

    return this.prisma.attendanceRecord.upsert({
      where: {
        enrollmentId_classPeriodId_date: {
          enrollmentId: dto.enrollmentId,
          classPeriodId: dto.classPeriodId,
          date: dateOnly,
        },
      },
      update: {
        status: AttendanceStatus.EXCUSED,
        justification: dto.reason,
        markedById: user.userId, // 🔥 JWT
      },
      create: {
        enrollmentId: dto.enrollmentId,
        classPeriodId: dto.classPeriodId,
        date: dateOnly,
        status: AttendanceStatus.EXCUSED,
        justification: dto.reason,
        markedById: user.userId, // 🔥 JWT
        method: AttendanceMethod.MANUAL,
      },
    });
  }

  // ==========================================
  // MÉTODOS PRIVADOS DE AYUDA (Sin Cambios)
  // ==========================================
  private calculateAttendanceStatus(
    startTimeStr: string,
    lateTol: number,
    absentTol: number,
  ): AttendanceStatus {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = startTimeStr.split(':').map(Number);
    const startTotalMinutes = startH * 60 + startM;

    const diffMinutes = currentMinutes - startTotalMinutes;

    if (diffMinutes > absentTol) return AttendanceStatus.ABSENT;
    if (diffMinutes > lateTol) return AttendanceStatus.LATE;
    return AttendanceStatus.PRESENT;
  }

  private buildScannerResponse(
    student: any,
    status: AttendanceStatus,
    message: string,
  ) {
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
  // 🧠 EL CEREBRO OMNICANAL DE NOTIFICACIONES PUSH
  // ==========================================
  private async processSmartNotification(
    enrollmentId: string,
    status: AttendanceStatus,
    scanTime: Date,
    institution: any,
  ) {
    let shouldNotify = false;

    // 1. EVALUAR LA REGLA DE LA DIRECTORA
    switch (institution.notificationFrequency) {
      case NotificationFrequency.PER_CLASS:
        shouldNotify = true;
        break;

      case NotificationFrequency.ALERTS_ONLY:
        if (
          status === AttendanceStatus.LATE ||
          status === AttendanceStatus.ABSENT
        ) {
          shouldNotify = true;
        }
        break;

      case NotificationFrequency.ENTRY_EXIT:
        const dateOnly = new Date(scanTime.toISOString().split('T')[0]);
        const recordsToday = await this.prisma.attendanceRecord.count({
          where: { enrollmentId, date: dateOnly },
        });
        if (recordsToday <= 1) {
          shouldNotify = true;
        }
        break;
    }

    if (!shouldNotify) return;

    // 2. BUSCAR LOS TOKENS DEL PADRE
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: {
          include: {
            guardians: { include: { guardian: { include: { user: true } } } },
          },
        },
      },
    });

    if (!enrollment || !enrollment.student.guardians) return;

    const fcmTokens = new Set<string>();
    enrollment.student.guardians.forEach((g: any) => {
      if (g.guardian.user?.fcmTokens) {
        g.guardian.user.fcmTokens.forEach((token: string) =>
          fcmTokens.add(token),
        );
      }
    });

    const tokensArray = Array.from(fcmTokens);
    if (tokensArray.length === 0) return;

    // 3. ARMAR EL MENSAJE DINÁMICO
    const firstName = enrollment.student.names.split(' ')[0];
    const timeStr = scanTime.toLocaleTimeString('es-BO', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let title = 'Control de Ingreso 🏫';
    let body = `${firstName} ha marcado asistencia a las ${timeStr}.`;

    if (status === AttendanceStatus.LATE) {
      title = 'Aviso de Atraso ⏰';
      body = `${firstName} ingresó con atraso a las ${timeStr}.`;
    } else if (status === AttendanceStatus.ABSENT) {
      title = 'Aviso de Inasistencia ⚠️';
      body = `${firstName} ha sido marcado como Ausente a las ${timeStr}.`;
    }

    // 4. DISPARAR A FIREBASE
    await this.firebaseService.sendMulticastNotification(
      tokensArray,
      title,
      body,
      { type: 'ATTENDANCE_UPDATE', status: status },
    );
  }
}

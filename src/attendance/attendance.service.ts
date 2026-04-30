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
import { FirebaseService } from '../firebase/firebase.service';

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
        'El sistema de asistencia está bloqueado. No hay ningún trimestre abierto actualmente.',
      );
    }
    return activeTrimester;
  }

  // ==========================================
  // 🔥 HELPER: ABAC - VERIFICAR PROPIEDAD DEL CURSO
  // ==========================================
  private async verifyTeacherClassroomAccess(user: any, classroomId: string) {
    const permissions = user.permissions || [];

    // Si tiene control total o acceso de lectura a toda la asistencia, lo dejamos pasar
    const isPowerUser =
      permissions.includes('manage:all:all') ||
      permissions.includes('read:all:Attendance') ||
      permissions.includes('manage:all:Attendance');

    if (isPowerUser) return;

    // Si no es admin, verificamos que sea el docente de este curso
    const isAssigned = await this.prisma.teacherAssignment.findFirst({
      where: { classroomId: classroomId, teacherId: user.userId },
    });

    if (!isAssigned) {
      throw new ForbiddenException(
        'Privacidad: No tienes carga horaria asignada a este curso. Acceso denegado.',
      );
    }
  }

  // ==========================================
  // 👨‍🏫 RUTAS DEL DOCENTE
  // ==========================================

  async getDailySchedule(date: string, user: any) {
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getUTCDay();

    return this.prisma.scheduleSlot.findMany({
      where: {
        dayOfWeek: dayOfWeek,
        teacherAssignment: { teacherId: user.userId },
      },
      include: {
        classPeriod: true,
        classroom: true,
        teacherAssignment: { include: { subject: true } },
        physicalSpace: true,
      },
      orderBy: { classPeriod: { startTime: 'asc' } },
    });
  }

  async getClassroomAttendance(
    classroomId: string,
    classPeriodId: string,
    date: string,
    user: any,
  ) {
    await this.verifyTeacherClassroomAccess(user, classroomId);

    const targetDate = new Date(date);
    const dateOnly = new Date(targetDate.toISOString().split('T')[0]);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classroomId, status: 'INSCRITO' },
      include: { student: true },
      orderBy: [
        { student: { lastNamePaterno: 'asc' } },
        { student: { names: 'asc' } },
      ],
    });

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        classPeriodId,
        date: dateOnly,
        enrollmentId: { in: enrollments.map((e) => e.id) },
      },
    });

    return enrollments.map((enrollment) => {
      const record = records.find((r) => r.enrollmentId === enrollment.id);
      return {
        enrollmentId: enrollment.id,
        student: enrollment.student,
        record: record || null,
      };
    });
  }

  async saveBulkAttendance(bulkData: any, user: any) {
    await this.ensureActiveTrimesterExists();
    await this.verifyTeacherClassroomAccess(user, bulkData.classroomId);

    const targetDate = new Date(bulkData.date);
    const dateOnly = new Date(targetDate.toISOString().split('T')[0]);
    const now = new Date();

    const institution = await this.prisma.institution.findFirst();
    if (!institution)
      throw new InternalServerErrorException('Reglas no configuradas');

    const results = await this.prisma.$transaction(
      bulkData.records.map((record: any) =>
        this.prisma.attendanceRecord.upsert({
          where: {
            enrollmentId_classPeriodId_date: {
              enrollmentId: record.enrollmentId,
              classPeriodId: bulkData.classPeriodId,
              date: dateOnly,
            },
          },
          update: {
            status: record.status,
            method: AttendanceMethod.MANUAL,
            markedById: user.userId,
            timestamp: now,
          },
          create: {
            enrollmentId: record.enrollmentId,
            classPeriodId: bulkData.classPeriodId,
            date: dateOnly,
            status: record.status,
            method: AttendanceMethod.MANUAL,
            markedById: user.userId,
            timestamp: now,
          },
        }),
      ),
    );

    bulkData.records.forEach((record: any) => {
      this.processSmartNotification(
        record.enrollmentId,
        record.status,
        now,
        institution,
      ).catch((e) => this.logger.error('Error enviando Push masivo', e));
    });

    return { message: 'Asistencia guardada con éxito', count: results.length };
  }

  // ==========================================
  // REGISTRO QR
  // ==========================================
  async registerScan(dto: RegisterAttendanceDto, user: any) {
    await this.ensureActiveTrimesterExists();

    const institution = await this.prisma.institution.findFirst();
    if (!institution)
      throw new InternalServerErrorException(
        'Reglas de institución no configuradas.',
      );

    if (
      !institution.enableQrAttendance &&
      (!dto.method || dto.method === AttendanceMethod.QR)
    ) {
      throw new ForbiddenException(
        'El marcado de asistencia por código QR está deshabilitado por Dirección.',
      );
    }

    const studentId = await this.identityService.validateQrToken(dto.qrToken);

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

    await this.verifyTeacherClassroomAccess(user, enrollment.classroomId);

    const classPeriod = await this.prisma.classPeriod.findUnique({
      where: { id: dto.classPeriodId },
    });
    if (!classPeriod)
      throw new NotFoundException('Periodo de clase no encontrado.');

    const status = this.calculateAttendanceStatus(
      classPeriod.startTime,
      institution.lateToleranceMinutes,
      institution.absentToleranceMinutes,
    );

    const now = new Date();
    const dateOnly = new Date(now.toISOString().split('T')[0]);

    try {
      await this.prisma.attendanceRecord.create({
        data: {
          enrollmentId: enrollment.id,
          classPeriodId: classPeriod.id,
          date: dateOnly,
          status: status,
          method: dto.method || AttendanceMethod.QR,
          timestamp: now,
          markedById: user.userId,
        },
      });

      this.processSmartNotification(
        enrollment.id,
        status,
        now,
        institution,
      ).catch((e) =>
        this.logger.error('Error enviando Push de asistencia QR', e),
      );
    } catch (error: any) {
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
  // 🔥 MONITOR EN VIVO
  // ==========================================
  async getDailyMonitor(
    dto: { classroomId: string; classPeriodId: string; date?: string },
    user: any,
  ) {
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
  // 🛠️ EL PLAN B: MARCADO MANUAL
  // ==========================================
  async markManualAttendance(
    dto: import('./dto/manual-attendance.dto').ManualAttendanceDto,
    user: any,
  ) {
    await this.ensureActiveTrimesterExists();

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: dto.enrollmentId },
    });
    if (!enrollment) throw new NotFoundException('Inscripción no encontrada');

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
        markedById: user.userId,
        timestamp: now,
      },
      create: {
        enrollmentId: dto.enrollmentId,
        classPeriodId: dto.classPeriodId,
        date: dateOnly,
        status: dto.status,
        method: AttendanceMethod.MANUAL,
        markedById: user.userId,
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
        markedById: user.userId,
        method: AttendanceMethod.MANUAL,
        updatedAt: new Date(),
      },
    });
  }

  // Resto de Helpers (Sin cambios funcionales)...
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

  private async processSmartNotification(
    enrollmentId: string,
    status: AttendanceStatus,
    scanTime: Date,
    institution: any,
  ) {
    let shouldNotify = false;

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

    await this.firebaseService.sendMulticastNotification(
      tokensArray,
      title,
      body,
      { type: 'ATTENDANCE_UPDATE', status: status },
    );
  }
}

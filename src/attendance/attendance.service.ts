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

    const isPowerUser =
      permissions.includes('manage:all:all') ||
      permissions.includes('read:all:Attendance') ||
      permissions.includes('manage:all:Attendance');

    if (isPowerUser) return;

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
  // 👨‍🏫 RUTAS DEL DOCENTE (MAGIA DE BLOQUES)
  // ==========================================

  async getDailySchedule(date: string, user: any) {
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getUTCDay();

    const slots = await this.prisma.scheduleSlot.findMany({
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

    // 🔥 Algoritmo de Agrupación de Bloques Consecutivos
    const blocks: any[] = [];
    let currentBlock: any = null;

    for (const slot of slots) {
      if (!currentBlock) {
        currentBlock = {
          id: `block_${slot.id}`,
          classroomId: slot.classroomId,
          classroom: slot.classroom,
          subjectName: slot.teacherAssignment.subject.name,
          teacherAssignmentId: slot.teacherAssignmentId,
          startTime: slot.classPeriod.startTime,
          endTime: slot.classPeriod.endTime,
          classPeriodIds: [slot.classPeriodId], // Array de IDs
          periodNames: [slot.classPeriod.name],
        };
      } else {
        // ¿Es el mismo curso y la misma materia que el slot anterior?
        if (
          currentBlock.teacherAssignmentId === slot.teacherAssignmentId &&
          currentBlock.classroomId === slot.classroomId
        ) {
          // Fusionamos al bloque actual
          currentBlock.endTime = slot.classPeriod.endTime;
          currentBlock.classPeriodIds.push(slot.classPeriodId);
          currentBlock.periodNames.push(slot.classPeriod.name);
        } else {
          // Nueva materia/curso, cerramos el bloque anterior y creamos uno nuevo
          blocks.push(currentBlock);
          currentBlock = {
            id: `block_${slot.id}`,
            classroomId: slot.classroomId,
            classroom: slot.classroom,
            subjectName: slot.teacherAssignment.subject.name,
            teacherAssignmentId: slot.teacherAssignmentId,
            startTime: slot.classPeriod.startTime,
            endTime: slot.classPeriod.endTime,
            classPeriodIds: [slot.classPeriodId],
            periodNames: [slot.classPeriod.name],
          };
        }
      }
    }
    if (currentBlock) blocks.push(currentBlock);

    return blocks;
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
        classPeriodId, // Comprobamos usando el primer periodo del bloque
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

  // 🔥 GUARDADO MASIVO (MÚLTIPLES PERIODOS A LA VEZ)
  async saveBulkAttendance(bulkData: any, user: any) {
    await this.ensureActiveTrimesterExists();
    await this.verifyTeacherClassroomAccess(user, bulkData.classroomId);

    const targetDate = new Date(bulkData.date);
    const dateOnly = new Date(targetDate.toISOString().split('T')[0]);
    const now = new Date();

    const institution = await this.prisma.institution.findFirst();
    if (!institution)
      throw new InternalServerErrorException('Reglas no configuradas');

    // Soporte para arreglo de periodos o fallback a un solo periodo
    const periodIds: string[] = bulkData.classPeriodIds || [
      bulkData.classPeriodId,
    ];

    const upsertOperations: any[] = []; // 🔥 Añade ": any[]"

    for (const record of bulkData.records) {
      for (const periodId of periodIds) {
        upsertOperations.push(
          this.prisma.attendanceRecord.upsert({
            where: {
              enrollmentId_classPeriodId_date: {
                enrollmentId: record.enrollmentId,
                classPeriodId: periodId,
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
              classPeriodId: periodId,
              date: dateOnly,
              status: record.status,
              method: AttendanceMethod.MANUAL,
              markedById: user.userId,
              timestamp: now,
            },
          }),
        );
      }
    }

    const results = await this.prisma.$transaction(upsertOperations);

    // Notificaciones (Solo procesamos una por estudiante, no por cada periodo)
    bulkData.records.forEach((record: any) => {
      this.processSmartNotification(
        record.enrollmentId,
        record.status,
        now,
        institution,
      ).catch((e) => this.logger.error('Error enviando Push masivo', e));
    });

    return {
      message: 'Asistencia guardada con éxito',
      count: bulkData.records.length,
    };
  }

  // ==========================================
  // REGISTRO QR (MÚLTIPLES PERIODOS A LA VEZ)
  // ==========================================
  async registerScan(dto: any, user: any) {
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

    // Soporte para arreglo de periodos o fallback
    const periodIds: string[] = dto.classPeriodIds || [dto.classPeriodId];

    // Calculamos el estatus basado en el PRIMER periodo del bloque
    const firstPeriod = await this.prisma.classPeriod.findUnique({
      where: { id: periodIds[0] },
    });

    if (!firstPeriod)
      throw new NotFoundException('Periodo de clase no encontrado.');

    const status = this.calculateAttendanceStatus(
      firstPeriod.startTime,
      institution.lateToleranceMinutes,
      institution.absentToleranceMinutes,
    );

    const now = new Date();
    const dateOnly = new Date(now.toISOString().split('T')[0]);

    try {
      await this.prisma.$transaction(
        periodIds.map((pId) =>
          this.prisma.attendanceRecord.create({
            data: {
              enrollmentId: enrollment.id,
              classPeriodId: pId,
              date: dateOnly,
              status: status,
              method: dto.method || AttendanceMethod.QR,
              timestamp: now,
              markedById: user.userId,
            },
          }),
        ),
      );

      this.processSmartNotification(
        enrollment.id,
        status,
        now,
        institution,
      ).catch((e) =>
        this.logger.error('Error enviando Push de asistencia QR', e),
      );
    } catch (error: any) {
      // Prisma lanza P2002 si el alumno ya escaneó en este bloque
      if (error.code === 'P2002') {
        this.logger.warn(
          `Escaneo duplicado ignorado para ${enrollment.student.names}`,
        );
        return this.buildScannerResponse(
          enrollment.student,
          status,
          'Ya Registrado en este Bloque',
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
  // 🛠️ EL PLAN B: MARCADO MANUAL (MÚLTIPLES PERIODOS)
  // ==========================================
  async markManualAttendance(dto: any, user: any) {
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

    const periodIds: string[] = dto.classPeriodIds || [dto.classPeriodId];

    const upsertOperations = periodIds.map((pId) =>
      this.prisma.attendanceRecord.upsert({
        where: {
          enrollmentId_classPeriodId_date: {
            enrollmentId: dto.enrollmentId,
            classPeriodId: pId,
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
          classPeriodId: pId,
          date: dateOnly,
          status: dto.status,
          method: AttendanceMethod.MANUAL,
          markedById: user.userId,
          timestamp: now,
        },
      }),
    );

    const records = await this.prisma.$transaction(upsertOperations);

    this.processSmartNotification(
      dto.enrollmentId,
      dto.status,
      now,
      institution,
    ).catch((e) =>
      this.logger.error('Error enviando Push de asistencia Manual', e),
    );

    return {
      data: records[0],
      message: `Asistencia marcada como ${dto.status} en el bloque`,
    };
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

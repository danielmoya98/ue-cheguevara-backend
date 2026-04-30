import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertGradeDto } from './dto/upsert-grade.dto';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ResolveChangeRequestDto } from './dto/resolve-change-request.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@Injectable()
export class GradesService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('notifications-queue') private notificationsQueue: Queue,
  ) {}

  // ==========================================
  // 🔥 HELPER: ABAC - VERIFICAR PROPIEDAD DE MATERIA
  // ==========================================
  private verifyAssignmentOwnership(assignment: any, user: any) {
    const permissions = user.permissions || [];

    // ABAC: Si tiene permiso global de lectura/manejo, pasa directo (Director/Secretaría)
    const isPowerUser =
      permissions.includes(SystemPermissions.MANAGE_ALL) ||
      permissions.includes(SystemPermissions.READ_ALL_GRADE);

    if (isPowerUser) return;

    // Si no es Power User, debe ser estrictamente el Docente dueño de la materia
    if (assignment.teacherId !== user.userId) {
      throw new ForbiddenException(
        'Privacidad: No tienes permiso para ver o alterar las calificaciones de una materia que no dictas.',
      );
    }
  }

  // ==========================================
  // PILAR 3: INSERCIÓN CON REFORZAMIENTO Y LEY 070
  // ==========================================
  async upsertGrade(data: UpsertGradeDto, user: any) {
    const trimester = await this.prisma.trimester.findUnique({
      where: { id: data.trimesterId },
    });

    if (!trimester) throw new NotFoundException('Trimestre no encontrado');
    if (!trimester.isOpen) {
      throw new ForbiddenException(
        'El trimestre actual se encuentra cerrado. Comuníquese con Dirección para solicitar una corrección.',
      );
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: data.enrollmentId },
    });
    if (!enrollment) throw new NotFoundException('Inscripción no encontrada');

    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: data.teacherAssignmentId },
    });
    if (!assignment)
      throw new NotFoundException('Asignación docente no encontrada');

    // Validación ABAC de propiedad
    this.verifyAssignmentOwnership(assignment, user);

    const existingGrade = await this.prisma.grade.findUnique({
      where: {
        enrollmentId_teacherAssignmentId_trimesterId: {
          enrollmentId: data.enrollmentId,
          teacherAssignmentId: data.teacherAssignmentId,
          trimesterId: data.trimesterId,
        },
      },
    });

    const currentSer =
      data.scoreSer !== undefined
        ? data.scoreSer
        : (existingGrade?.scoreSer ?? null);
    const currentSaber =
      data.scoreSaber !== undefined
        ? data.scoreSaber
        : (existingGrade?.scoreSaber ?? null);
    const currentHacer =
      data.scoreHacer !== undefined
        ? data.scoreHacer
        : (existingGrade?.scoreHacer ?? null);
    const currentAuto =
      data.scoreAuto !== undefined
        ? data.scoreAuto
        : (existingGrade?.scoreAuto ?? null);
    let currentRecovery =
      data.recoveryScore !== undefined
        ? data.recoveryScore
        : (existingGrade?.recoveryScore ?? null);

    let totalScore: number | null = null;
    let finalScore: number | null = null;

    if (
      currentSer !== null ||
      currentSaber !== null ||
      currentHacer !== null ||
      currentAuto !== null
    ) {
      totalScore =
        (currentSer || 0) +
        (currentSaber || 0) +
        (currentHacer || 0) +
        (currentAuto || 0);

      if (totalScore >= 51) {
        currentRecovery = null;
        finalScore = totalScore;
      } else {
        if (currentRecovery !== null) {
          finalScore = Math.min(currentRecovery, 51);
        } else {
          finalScore = totalScore;
        }
      }
    }

    const savedGrade = await this.prisma.grade.upsert({
      where: {
        enrollmentId_teacherAssignmentId_trimesterId: {
          enrollmentId: data.enrollmentId,
          teacherAssignmentId: data.teacherAssignmentId,
          trimesterId: data.trimesterId,
        },
      },
      update: {
        scoreSer: currentSer,
        scoreSaber: currentSaber,
        scoreHacer: currentHacer,
        scoreAuto: currentAuto,
        totalScore,
        recoveryScore: currentRecovery,
        finalScore,
        status: data.status || existingGrade?.status,
        lastModifiedById: user.userId,
      },
      create: {
        enrollmentId: data.enrollmentId,
        teacherAssignmentId: data.teacherAssignmentId,
        trimesterId: data.trimesterId,
        scoreSer: currentSer,
        scoreSaber: currentSaber,
        scoreHacer: currentHacer,
        scoreAuto: currentAuto,
        totalScore,
        recoveryScore: currentRecovery,
        finalScore,
        status: data.status || 'DRAFT',
        lastModifiedById: user.userId,
      },
    });

    if (
      savedGrade.finalScore !== null &&
      savedGrade.finalScore < 51 &&
      savedGrade.status === 'PUBLISHED'
    ) {
      const assignmentInfo = await this.prisma.teacherAssignment.findUnique({
        where: { id: data.teacherAssignmentId },
        include: { subject: true },
      });

      await this.notificationsQueue.add('grade-alert', {
        enrollmentId: data.enrollmentId,
        subjectName: assignmentInfo?.subject.name || 'una materia',
        finalScore: savedGrade.finalScore,
      });
    }

    return savedGrade;
  }

  async getGradesByAssignment(
    teacherAssignmentId: string,
    trimesterId: string,
    user: any,
  ) {
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      include: { classroom: true, subject: true },
    });

    if (!assignment) throw new NotFoundException('Asignación no encontrada');

    this.verifyAssignmentOwnership(assignment, user);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classroomId: assignment.classroomId,
        status: { in: ['INSCRITO', 'OBSERVADO'] },
      },
      include: {
        student: {
          select: {
            id: true,
            names: true,
            lastNamePaterno: true,
            lastNameMaterno: true,
            ci: true,
          },
        },
        grades: {
          where: { teacherAssignmentId, trimesterId },
        },
      },
      orderBy: [
        { student: { lastNamePaterno: 'asc' } },
        { student: { names: 'asc' } },
      ],
    });

    return enrollments.map((e) => ({
      enrollmentId: e.id,
      student: e.student,
      grade: e.grades.length > 0 ? e.grades[0] : null,
    }));
  }

  // ==========================================
  // PILAR 2: CHANGE REQUESTS (DESCONGELAMIENTO)
  // ==========================================

  async createChangeRequest(data: CreateChangeRequestDto, user: any) {
    const grade = await this.prisma.grade.findUnique({
      where: { id: data.gradeId },
      include: { teacherAssignment: true },
    });

    if (!grade)
      throw new NotFoundException('Calificación original no encontrada');

    this.verifyAssignmentOwnership(grade.teacherAssignment, user);

    return await this.prisma.gradeChangeRequest.create({
      data: {
        gradeId: data.gradeId,
        requestedById: user.userId,
        reason: data.reason,
        proposedSer: data.proposedSer,
        proposedSaber: data.proposedSaber,
        proposedHacer: data.proposedHacer,
        proposedAuto: data.proposedAuto,
        status: 'PENDING',
      },
    });
  }

  async getPendingRequests() {
    return await this.prisma.gradeChangeRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        grade: {
          include: {
            enrollment: { include: { student: true } },
            teacherAssignment: { include: { subject: true, teacher: true } },
            trimester: true,
          },
        },
      },
      orderBy: { grade: { trimester: { startDate: 'desc' } } },
    });
  }

  async resolveChangeRequest(
    requestId: string,
    data: ResolveChangeRequestDto,
    user: any,
  ) {
    const request = await this.prisma.gradeChangeRequest.findUnique({
      where: { id: requestId },
      include: { grade: true },
    });

    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== 'PENDING')
      throw new ForbiddenException('Esta solicitud ya fue resuelta');

    return await this.prisma.$transaction(async (tx) => {
      const resolvedReq = await tx.gradeChangeRequest.update({
        where: { id: requestId },
        data: {
          status: data.status,
          approvedById: user.userId,
          resolvedAt: new Date(),
        },
      });

      if (data.status === 'APPROVED') {
        const { grade } = request;

        const newSer = request.proposedSer ?? grade.scoreSer;
        const newSaber = request.proposedSaber ?? grade.scoreSaber;
        const newHacer = request.proposedHacer ?? grade.scoreHacer;
        const newAuto = request.proposedAuto ?? grade.scoreAuto;

        const totalScore =
          (newSer || 0) + (newSaber || 0) + (newHacer || 0) + (newAuto || 0);

        let finalScore = totalScore;
        let recoveryScore = grade.recoveryScore;

        if (totalScore >= 51) {
          recoveryScore = null;
          finalScore = totalScore;
        } else if (recoveryScore !== null) {
          finalScore = Math.min(recoveryScore, 51);
        } else {
          finalScore = totalScore;
        }

        await tx.grade.update({
          where: { id: grade.id },
          data: {
            scoreSer: newSer,
            scoreSaber: newSaber,
            scoreHacer: newHacer,
            scoreAuto: newAuto,
            totalScore,
            recoveryScore,
            finalScore,
            lastModifiedById: user.userId,
            status: 'PUBLISHED',
          },
        });
      }

      return resolvedReq;
    });
  }
}

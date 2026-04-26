import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertGradeDto } from './dto/upsert-grade.dto';
// 🔥 Necesitamos importar los permisos para que el ABAC reconozca al ADMIN
import { SystemPermissions } from '../auth/constants/permissions.constant';

@Injectable()
export class GradesService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // HELPER: ABAC - VERIFICAR PROPIEDAD DE MATERIA
  // ==========================================
  private verifyAssignmentOwnership(assignment: any, user: any) {
    // Si tiene el permiso supremo (Admin/Director), pasa directo
    if (user.permissions.includes(SystemPermissions.MANAGE_ALL)) return;

    // Si es docente, la materia DEBE pertenecerle
    if (assignment.teacherId !== user.userId) {
      throw new ForbiddenException(
        'Privacidad: No tienes permiso para ver o alterar las calificaciones de una materia que no dictas.',
      );
    }
  }

  /**
   * Registra o actualiza la calificación de un estudiante.
   */
  async upsertGrade(data: UpsertGradeDto, user: any) {
    // 1. Validar que el Trimestre esté ABIERTO
    const trimester = await this.prisma.trimester.findUnique({
      where: { id: data.trimesterId },
    });

    if (!trimester) throw new NotFoundException('Trimestre no encontrado');
    if (!trimester.isOpen) {
      throw new ForbiddenException(
        'El trimestre actual se encuentra cerrado. Comuníquese con Dirección.',
      );
    }

    // 2. Validar que el estudiante y la asignación existan
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: data.enrollmentId },
    });
    if (!enrollment) throw new NotFoundException('Inscripción no encontrada');

    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: data.teacherAssignmentId },
    });
    if (!assignment)
      throw new NotFoundException('Asignación docente no encontrada');

    // 🔥 3. POLÍTICA ABAC: ¿Es dueño de la materia?
    this.verifyAssignmentOwnership(assignment, user);

    // 4. Obtener nota actual
    const existingGrade = await this.prisma.grade.findUnique({
      where: {
        enrollmentId_teacherAssignmentId_trimesterId: {
          enrollmentId: data.enrollmentId,
          teacherAssignmentId: data.teacherAssignmentId,
          trimesterId: data.trimesterId,
        },
      },
    });

    // 5. MOTOR MATEMÁTICO: Calcular el Total
    const currentSer = data.scoreSer ?? existingGrade?.scoreSer ?? null;
    const currentSaber = data.scoreSaber ?? existingGrade?.scoreSaber ?? null;
    const currentHacer = data.scoreHacer ?? existingGrade?.scoreHacer ?? null;
    const currentAuto = data.scoreAuto ?? existingGrade?.scoreAuto ?? null;

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

      finalScore = totalScore;
    }

    // 6. Ejecutar UPSERT
    return await this.prisma.grade.upsert({
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
        finalScore,
        status: data.status || existingGrade?.status,
        lastModifiedById: user.userId, // 🔥 Corrección: Extraído limpiamente del JWT
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
        finalScore,
        status: data.status || 'DRAFT',
        lastModifiedById: user.userId, // 🔥 Corrección: Extraído limpiamente del JWT
      },
    });
  }

  /**
   * Obtiene la planilla completa de un curso para una materia y trimestre específico.
   */
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

    // 🔥 POLÍTICA ABAC: ¿Puede ver estas notas?
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
}

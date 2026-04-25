import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertGradeDto } from './dto/upsert-grade.dto';

@Injectable()
export class GradesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Registra o actualiza la calificación de un estudiante.
   * El cálculo matemático se realiza exclusivamente en el backend.
   */
  async upsertGrade(data: UpsertGradeDto, userId: string) {
    // 1. Validar que el Trimestre esté ABIERTO (BLINDAJE)
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

    // 3. Obtener nota actual (si existe) para no sobreescribir valores en blanco con ceros
    const existingGrade = await this.prisma.grade.findUnique({
      where: {
        enrollmentId_teacherAssignmentId_trimesterId: {
          enrollmentId: data.enrollmentId,
          teacherAssignmentId: data.teacherAssignmentId,
          trimesterId: data.trimesterId,
        },
      },
    });

    // 4. MOTOR MATEMÁTICO: Calcular el Total (Mantenemos nulos si no hay nota aún)
    const currentSer = data.scoreSer ?? existingGrade?.scoreSer ?? null;
    const currentSaber = data.scoreSaber ?? existingGrade?.scoreSaber ?? null;
    const currentHacer = data.scoreHacer ?? existingGrade?.scoreHacer ?? null;
    const currentAuto = data.scoreAuto ?? existingGrade?.scoreAuto ?? null;

    let totalScore: number | null = null;
    let finalScore: number | null = null;

    // Solo sumamos si al menos hay una nota ingresada
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

      // La nota final oficial será el totalScore (El reforzamiento se aplicará en otra función más adelante)
      finalScore = totalScore;
    }

    // 5. Ejecutar UPSERT (Crear o Actualizar)
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
        lastModifiedById: userId, // Auditoría: Quién hizo el último cambio
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
        lastModifiedById: userId,
      },
    });
  }

  /**
   * Obtiene la planilla completa de un curso para una materia y trimestre específico.
   * Ideal para el DataGrid del Frontend.
   */
  async getGradesByAssignment(
    teacherAssignmentId: string,
    trimesterId: string,
  ) {
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      include: { classroom: true, subject: true },
    });

    if (!assignment) throw new NotFoundException('Asignación no encontrada');

    // Buscamos a todos los estudiantes INSCRITOS en ese curso
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classroomId: assignment.classroomId,
        status: { in: ['INSCRITO', 'OBSERVADO'] }, // Excluimos retirados
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
        // Traemos su nota para esta materia y trimestre
        grades: {
          where: { teacherAssignmentId, trimesterId },
        },
      },
      orderBy: [
        { student: { lastNamePaterno: 'asc' } },
        { student: { names: 'asc' } },
      ],
    });

    // Formateamos la respuesta para que el DataGrid del frontend la consuma fácil
    return enrollments.map((e) => ({
      enrollmentId: e.id,
      student: e.student,
      grade: e.grades.length > 0 ? e.grades[0] : null, // Si es null, sus casillas estarán vacías
    }));
  }
}

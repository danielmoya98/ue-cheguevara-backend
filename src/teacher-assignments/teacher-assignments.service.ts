import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CloneAssignmentsDto } from './dto/clone-assignments.dto';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@Injectable()
export class TeacherAssignmentsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateTeacherAssignmentDto) {
    // 🔥 BUG CORREGIDO: Buscamos la relación role en lugar del enum estático
    const teacher = await this.prisma.user.findUnique({
      where: { id: data.teacherId },
      include: { role: true },
    });

    if (!teacher || teacher.role?.name !== 'DOCENTE') {
      throw new BadRequestException(
        'El usuario asignado no existe o no tiene el rol de DOCENTE.',
      );
    }

    try {
      return await this.prisma.teacherAssignment.create({
        data,
        include: {
          teacher: { select: { fullName: true } },
          subject: { select: { name: true } },
          classroom: { select: { grade: true, section: true } },
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Este curso ya tiene un docente asignado para esta materia.',
        );
      }
      throw error;
    }
  }

  async cloneAssignments(data: CloneAssignmentsDto) {
    if (data.targetClassroomIds.length === 0 || data.assignments.length === 0) {
      throw new BadRequestException(
        'Debe seleccionar al menos un curso destino y una materia.',
      );
    }

    const recordsToInsert: {
      classroomId: string;
      subjectId: string;
      teacherId: string;
    }[] = [];

    for (const targetId of data.targetClassroomIds) {
      for (const assignment of data.assignments) {
        recordsToInsert.push({
          classroomId: targetId,
          subjectId: assignment.subjectId,
          teacherId: assignment.teacherId,
        });
      }
    }

    const result = await this.prisma.teacherAssignment.createMany({
      data: recordsToInsert,
      skipDuplicates: true,
    });

    return {
      message: 'Clonación completada con éxito',
      clonedCount: result.count,
    };
  }

  async findAll(
    query: PaginationDto & {
      academicYearId?: string;
      classroomId?: string;
      teacherId?: string;
    },
    user: any,
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    let { academicYearId, classroomId, teacherId } = query;

    // 🔥 ABAC: Si es un Docente, forzamos que solo vea SU propia carga horaria
    if (!user.permissions.includes(SystemPermissions.MANAGE_ALL)) {
      teacherId = user.userId;
    }

    const whereCondition: any = {
      ...(classroomId && { classroomId }),
      ...(teacherId && { teacherId }),
      ...(academicYearId && { classroom: { academicYearId } }),
    };

    const [total, data] = await Promise.all([
      this.prisma.teacherAssignment.count({ where: whereCondition }),
      this.prisma.teacherAssignment.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: [
          { classroom: { grade: 'asc' } },
          { subject: { name: 'asc' } },
        ],
        include: {
          teacher: { select: { id: true, fullName: true, email: true } },
          subject: {
            select: { id: true, name: true, level: true, area: true },
          },
          classroom: {
            select: {
              id: true,
              level: true,
              grade: true,
              section: true,
              shift: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async remove(id: string) {
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada');
    }

    // 🔥 DEUDA TÉCNICA RESUELTA: Protección de Integridad (Calificaciones)
    const gradesCount = await this.prisma.grade.count({
      where: { teacherAssignmentId: id },
    });

    if (gradesCount > 0) {
      throw new ConflictException(
        'Operación bloqueada: No se puede quitar al docente porque ya existen calificaciones registradas para esta materia.',
      );
    }

    // 🔥 DEUDA TÉCNICA RESUELTA: Protección de Integridad (Horarios)
    const schedulesCount = await this.prisma.scheduleSlot.count({
      where: { teacherAssignmentId: id },
    });

    if (schedulesCount > 0) {
      throw new ConflictException(
        'Operación bloqueada: No se puede eliminar esta asignación porque la materia ya está distribuida en el Horario Escolar.',
      );
    }

    await this.prisma.teacherAssignment.delete({ where: { id } });
    return { message: 'Asignación eliminada correctamente' };
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Role } from '../../prisma/generated/client';
import { CloneAssignmentsDto } from './dto/clone-assignments.dto';

@Injectable()
export class TeacherAssignmentsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateTeacherAssignmentDto) {
    // 1. Validar que el usuario asignado sea realmente un DOCENTE
    const teacher = await this.prisma.user.findUnique({
      where: { id: data.teacherId },
    });
    if (!teacher || teacher.role !== Role.DOCENTE) {
      throw new BadRequestException(
        'El usuario asignado no existe o no tiene el rol de DOCENTE.',
      );
    }

    // 2. Intentar crear la asignación
    try {
      return await this.prisma.teacherAssignment.create({
        data,
        include: {
          teacher: { select: { fullName: true } },
          subject: { select: { name: true } },
          classroom: { select: { grade: true, section: true } },
        },
      });
    } catch (error) {
      // P2002: Prisma detecta violación de nuestro @@unique([classroomId, subjectId])
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Este curso ya tiene un docente asignado para esta materia.',
        );
      }
      throw error;
    }
  }

  // ... (debajo del método create)

  async cloneAssignments(data: CloneAssignmentsDto) {
    if (data.targetClassroomIds.length === 0 || data.assignments.length === 0) {
      throw new BadRequestException(
        'Debe seleccionar al menos un curso destino y una materia.',
      );
    }

    // ✅ SOLUCIÓN: Definimos explícitamente la estructura del Array para TypeScript
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
  // Obtenemos las asignaciones filtrando dinámicamente por Año, Curso o Docente
  async findAll(
    query: PaginationDto & {
      academicYearId?: string;
      classroomId?: string;
      teacherId?: string;
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20; // Aumentamos el límite porque las cargas horarias son largas
    const skip = (page - 1) * limit;

    const { academicYearId, classroomId, teacherId } = query;

    const whereCondition: any = {
      ...(classroomId && { classroomId }),
      ...(teacherId && { teacherId }),
      // Si mandamos el año escolar, buscamos dentro de la relación de cursos
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

    // TODO en Fase Estudiantes: Validar que no haya notas registradas antes de quitar al docente

    await this.prisma.teacherAssignment.delete({ where: { id } });
    return { message: 'Asignación eliminada correctamente' };
  }
}

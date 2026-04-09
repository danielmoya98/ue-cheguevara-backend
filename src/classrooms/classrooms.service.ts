import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AcademicStatus, Role, Shift } from '../../prisma/generated/client';
import { CreateBulkClassroomsDto } from './dto/create-bulk-classrooms.dto';

@Injectable()
export class ClassroomsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateClassroomDto) {
    // 1. Validar que la gestión exista y NO esté cerrada
    const year = await this.prisma.academicYear.findUnique({
      where: { id: data.academicYearId },
    });
    if (!year) throw new NotFoundException('La gestión académica no existe');
    if (year.status === AcademicStatus.CLOSED) {
      throw new BadRequestException(
        'No se pueden crear cursos en una gestión cerrada',
      );
    }

    // 2. Validar al Tutor (si se envía)
    if (data.advisorId) {
      const teacher = await this.prisma.user.findUnique({
        where: { id: data.advisorId },
      });
      if (!teacher || teacher.role !== Role.DOCENTE) {
        throw new BadRequestException(
          'El asesor asignado debe ser un Docente válido',
        );
      }
    }

    // 3. Crear el curso (Manejando la regla @@unique de Prisma)
    try {
      return await this.prisma.classroom.create({
        data,
        include: { advisor: { select: { fullName: true } } }, // Devolvemos el nombre del tutor
      });
    } catch (error: any) {
      // P2002 es el código de Prisma para violación de restricción única
      if (error.code === 'P2002') {
        throw new ConflictException(
          `El curso ${data.grade} ${data.section} de ${data.level} (${data.shift}) ya existe en esta gestión.`,
        );
      }
      throw error;
    }
  }

  // 🔥 Se añaden los nuevos parámetros opcionales
  async findAll(
    query: PaginationDto & {
      academicYearId?: string;
      level?: string;
      shift?: string;
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search, academicYearId, level, shift } = query;

    const whereCondition: any = {
      // O Prisma.ClassroomWhereInput si aplicaste la mejora anterior
      ...(academicYearId && { academicYearId }),
      ...(level && { level }),
      ...(shift && { shift }),
      ...(search && {
        OR: [
          { grade: { contains: search, mode: 'insensitive' } },
          { section: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.classroom.count({ where: whereCondition }),
      this.prisma.classroom.findMany({
        where: whereCondition,
        skip: skip,
        take: limit,
        orderBy: [{ level: 'asc' }, { grade: 'asc' }, { section: 'asc' }],
        include: {
          advisor: { select: { id: true, fullName: true } },
          academicYear: { select: { year: true, status: true } },

          // 🔥 AQUÍ ESTÁ LA SOLUCIÓN AL CONTADOR FANTASMA
          _count: {
            select: {
              enrollments: {
                where: {
                  // Solo contamos a los alumnos que ocupan un asiento físico o virtual
                  status: {
                    in: ['INSCRITO', 'REVISION_SIE', 'OBSERVADO'],
                  },
                },
              },
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

  async findOne(id: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      include: { advisor: { select: { id: true, fullName: true } } },
    });
    if (!classroom) throw new NotFoundException('Curso no encontrado');
    return classroom;
  }

  async createBulk(data: CreateBulkClassroomsDto) {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: data.academicYearId },
    });
    if (!year || year.status === AcademicStatus.CLOSED) {
      throw new BadRequestException('Gestión académica inválida o cerrada');
    }

    const payload = data.classrooms.map((c) => ({
      academicYearId: data.academicYearId,
      level: data.level,
      shift: data.shift,
      grade: c.grade,
      section: c.section,
      capacity: c.capacity,
    }));

    // Prisma hace un solo INSERT masivo ultra rápido
    const result = await this.prisma.classroom.createMany({
      data: payload,
      skipDuplicates: true, // Ignora silenciosamente si ya existe (Ej: Primero A ya estaba creado)
    });

    return {
      message: `Proceso completado. Se crearon ${result.count} cursos nuevos.`,
      createdCount: result.count,
    };
  }

  async update(id: string, data: UpdateClassroomDto) {
    await this.findOne(id); // Validamos que exista

    if (data.advisorId) {
      const teacher = await this.prisma.user.findUnique({
        where: { id: data.advisorId },
      });
      if (!teacher || teacher.role !== Role.DOCENTE) {
        throw new BadRequestException(
          'El asesor asignado debe ser un Docente válido',
        );
      }
    }

    try {
      return await this.prisma.classroom.update({
        where: { id },
        data,
        include: { advisor: { select: { fullName: true } } },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Los cambios generan un curso duplicado en esta gestión.',
        );
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    // TODO en el futuro: Validar que no tenga estudiantes inscritos antes de borrar
    await this.prisma.classroom.delete({ where: { id } });
    return { message: 'Curso eliminado correctamente' };
  }
}

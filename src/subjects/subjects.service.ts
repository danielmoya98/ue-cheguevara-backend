import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { EducationLevel } from '../../prisma/generated/client';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateSubjectDto) {
    // Validar duplicados exactos en el mismo nivel
    const existing = await this.prisma.subject.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        level: data.level,
      },
    });

    if (existing) {
      throw new ConflictException(
        `La materia '${data.name}' ya existe en el nivel ${data.level}.`,
      );
    }

    return this.prisma.subject.create({ data });
  }

  async findAll(query: PaginationDto & { level?: EducationLevel }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const search = query.search || '';
    const level = query.level;

    const skip = (page - 1) * limit;

    const whereCondition: any = {
      ...(level && { level }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { area: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.subject.count({ where: whereCondition }),
      this.prisma.subject.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: [{ level: 'asc' }, { area: 'asc' }, { name: 'asc' }],
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Materia no encontrada');
    return subject;
  }

  async update(id: string, data: UpdateSubjectDto) {
    await this.findOne(id); // Validamos que exista

    if (data.name || data.level) {
      const existing = await this.prisma.subject.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          level: data.level,
          id: { not: id }, // Excluimos la materia actual de la búsqueda
        },
      });

      if (existing) {
        throw new ConflictException(
          'Ya existe otra materia con ese nombre en este nivel.',
        );
      }
    }

    return this.prisma.subject.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);

    // 🔥 REGLA DE INTEGRIDAD: Validar que la materia no esté asignada
    const assignmentsCount = await this.prisma.teacherAssignment.count({
      where: { subjectId: id },
    });

    if (assignmentsCount > 0) {
      throw new ConflictException(
        'No se puede eliminar la materia porque ya se encuentra asignada a uno o más docentes en la carga horaria.',
      );
    }

    await this.prisma.subject.delete({ where: { id } });
    return { message: 'Materia eliminada correctamente' };
  }
}

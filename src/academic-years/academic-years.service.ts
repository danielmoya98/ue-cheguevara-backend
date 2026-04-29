import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AcademicStatus, TrimesterName } from '../../prisma/generated/client';

@Injectable()
export class AcademicYearsService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // REGLAS DE NEGOCIO INTERNAS
  // ==========================================

  private async deactivateOtherActiveYears(excludeId?: string) {
    await this.prisma.academicYear.updateMany({
      where: {
        status: AcademicStatus.ACTIVE,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { status: AcademicStatus.CLOSED },
    });
  }

  // ==========================================
  // MÉTODOS CRUD PRINCIPALES
  // ==========================================

  async create(data: CreateAcademicYearDto) {
    const existingYear = await this.prisma.academicYear.findUnique({
      where: { year: data.year },
    });

    if (existingYear) {
      throw new ConflictException(
        `La gestión ${data.year} ya está registrada.`,
      );
    }

    if (data.startDate >= data.endDate) {
      throw new BadRequestException(
        'La fecha de inicio debe ser menor a la fecha de fin.',
      );
    }

    // Transacción Atómica + Auto-Creación de Trimestres
    return this.prisma.$transaction(async (tx) => {
      if (data.status === AcademicStatus.ACTIVE) {
        await tx.academicYear.updateMany({
          where: { status: AcademicStatus.ACTIVE },
          data: { status: AcademicStatus.CLOSED },
        });
      }

      // 1. Creamos la Gestión
      const newYear = await tx.academicYear.create({ data });

      // 2. Generamos los 3 trimestres por defecto (Cerrados y con fechas base)
      await tx.trimester.createMany({
        data: [
          {
            academicYearId: newYear.id,
            name: TrimesterName.PRIMER_TRIMESTRE,
            startDate: data.startDate,
            endDate: data.endDate,
            isOpen: false,
          },
          {
            academicYearId: newYear.id,
            name: TrimesterName.SEGUNDO_TRIMESTRE,
            startDate: data.startDate,
            endDate: data.endDate,
            isOpen: false,
          },
          {
            academicYearId: newYear.id,
            name: TrimesterName.TERCER_TRIMESTRE,
            startDate: data.startDate,
            endDate: data.endDate,
            isOpen: false,
          },
        ],
      });

      return newYear;
    });
  }

  async findAll(query: PaginationDto) {
    const { page = 1, limit = 10, search, sort } = query;
    const skip = (page - 1) * limit;

    const whereCondition: any = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    let orderBy = {};
    if (sort) {
      const isDesc = sort.startsWith('-');
      const field = isDesc ? sort.substring(1) : sort;
      orderBy = { [field]: isDesc ? 'desc' : 'asc' };
    } else {
      orderBy = { year: 'desc' };
    }

    const [total, data] = await Promise.all([
      this.prisma.academicYear.count({ where: whereCondition }),
      this.prisma.academicYear.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id },
    });
    if (!academicYear)
      throw new NotFoundException('Gestión académica no encontrada');
    return academicYear;
  }

  async findCurrentActive() {
    const current = await this.prisma.academicYear.findFirst({
      where: { status: AcademicStatus.ACTIVE },
      include: {
        trimesters: {
          orderBy: { name: 'asc' },
        },
      },
    });
    return current || null;
  }

  async update(id: string, data: UpdateAcademicYearDto) {
    const currentYear = await this.findOne(id);

    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      throw new BadRequestException(
        'La fecha de inicio debe ser menor a la fecha de fin.',
      );
    }

    if (data.year) {
      const existingYear = await this.prisma.academicYear.findUnique({
        where: { year: data.year },
      });
      if (existingYear && existingYear.id !== id) {
        throw new ConflictException(`La gestión ${data.year} ya existe.`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (
        data.status === AcademicStatus.ACTIVE &&
        currentYear.status !== AcademicStatus.ACTIVE
      ) {
        await tx.academicYear.updateMany({
          where: {
            status: AcademicStatus.ACTIVE,
            id: { not: id },
          },
          data: { status: AcademicStatus.CLOSED },
        });
      }

      return tx.academicYear.update({
        where: { id },
        data,
      });
    });
  }

  async remove(id: string) {
    const year = await this.findOne(id);

    const classroomsCount = await this.prisma.classroom.count({
      where: { academicYearId: id },
    });

    if (classroomsCount > 0) {
      throw new ConflictException(
        'No se puede eliminar la gestión porque tiene cursos y paralelos asignados. Cámbiela a estado CLOSED.',
      );
    }

    await this.prisma.trimester.deleteMany({ where: { academicYearId: id } });
    await this.prisma.academicYear.delete({ where: { id } });

    return { message: `Gestión ${year.year} eliminada correctamente.` };
  }
}

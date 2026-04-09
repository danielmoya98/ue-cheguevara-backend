import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class InstitutionsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateInstitutionDto) {
    const existing = await this.prisma.institution.findUnique({
      where: { rueCode: data.rueCode },
    });
    if (existing)
      throw new ConflictException('El Código RUE ya está registrado');

    const institution = await this.prisma.institution.create({ data });
    return {
      data: institution,
      message: 'Institución registrada exitosamente',
    };
  }

  async findAll(query: PaginationDto) {
    const { page = 1, limit = 10, search, sort } = query;
    const skip = (page - 1) * limit;

    // 1. Filtros y Búsqueda (Punto 8 y 10)
    const whereCondition = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as any } },
            { rueCode: { contains: search } },
          ],
        }
      : {};

    // 2. Ordenamiento Dinámico (Punto 9)
    let orderBy = {};
    if (sort) {
      const isDesc = sort.startsWith('-');
      const field = isDesc ? sort.substring(1) : sort;
      orderBy = { [field]: isDesc ? 'desc' : 'asc' };
    } else {
      orderBy = { createdAt: 'desc' }; // Default
    }

    // 3. Ejecución Paralela (Performance - Punto 27)
    const [total, data] = await Promise.all([
      this.prisma.institution.count({ where: whereCondition }),
      this.prisma.institution.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy,
        include: { director: { select: { fullName: true, email: true } } }, // Relación limpia
      }),
    ]);

    // 4. Estructura Exacta Paginada (Punto 7)
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: { director: { select: { fullName: true, email: true } } },
    });
    if (!institution) throw new NotFoundException('Institución no encontrada');
    return { data: institution };
  }

  async update(id: string, updateData: UpdateInstitutionDto) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
    });
    if (!institution) throw new NotFoundException('Institución no encontrada');

    const updated = await this.prisma.institution.update({
      where: { id },
      data: updateData,
    });
    return { data: updated, message: 'Datos institucionales actualizados' };
  }
}

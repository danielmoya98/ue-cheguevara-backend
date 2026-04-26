import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTrimesterDto } from './dto/update-trimester.dto';

@Injectable()
export class TrimestersService {
  constructor(private prisma: PrismaService) {}

  async getByAcademicYear(academicYearId: string) {
    return this.prisma.trimester.findMany({
      where: { academicYearId },
      orderBy: { name: 'asc' }, // PRIMER, SEGUNDO, TERCER
    });
  }

  async update(id: string, data: UpdateTrimesterDto) {
    const trimester = await this.prisma.trimester.findUnique({ where: { id } });
    if (!trimester) throw new NotFoundException('Trimestre no encontrado');

    const newStartDate = data.startDate
      ? new Date(data.startDate)
      : trimester.startDate;
    const newEndDate = data.endDate
      ? new Date(data.endDate)
      : trimester.endDate;

    if (newStartDate >= newEndDate) {
      throw new BadRequestException(
        'La fecha de inicio debe ser menor a la fecha de fin',
      );
    }

    return this.prisma.trimester.update({
      where: { id },
      data: {
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
        ...(data.isOpen !== undefined && { isOpen: data.isOpen }),
      },
    });
  }
}

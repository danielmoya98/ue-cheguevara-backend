import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassPeriodDto } from './dto/create-class-period.dto';
import { UpdateClassPeriodDto } from './dto/update-class-period.dto';
import { Shift } from '../../prisma/generated/client';

@Injectable()
export class ClassPeriodsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateClassPeriodDto) {
    // Validar superposición de orden en el mismo turno
    const existingOrder = await this.prisma.classPeriod.findFirst({
      where: { shift: data.shift, order: data.order }
    });

    if (existingOrder) {
      throw new ConflictException(`Ya existe un periodo con el orden ${data.order} en el turno ${data.shift}.`);
    }

    return this.prisma.classPeriod.create({ data });
  }

  async findAll(shift?: Shift) {
    return this.prisma.classPeriod.findMany({
      where: shift ? { shift } : undefined,
      orderBy: { order: 'asc' },
    });
  }

  async update(id: string, data: UpdateClassPeriodDto) {
    const period = await this.prisma.classPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException('Periodo no encontrado');

    return this.prisma.classPeriod.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const period = await this.prisma.classPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException('Periodo no encontrado');

    // 🛡️ PROTECCIÓN DE INTEGRIDAD 1: Horarios
    const linkedSlots = await this.prisma.scheduleSlot.count({
      where: { classPeriodId: id },
    });
    if (linkedSlots > 0) {
      throw new ConflictException(
        'No puedes eliminar este periodo porque ya hay materias asignadas a él en el Horario Escolar. Debes liberar el horario primero.'
      );
    }

    // 🛡️ PROTECCIÓN DE INTEGRIDAD 2: Asistencia
    const linkedAttendance = await this.prisma.attendanceRecord.count({
      where: { classPeriodId: id },
    });
    if (linkedAttendance > 0) {
      throw new ConflictException(
        'No puedes eliminar este periodo porque existen registros de asistencia de alumnos vinculados a él.'
      );
    }

    await this.prisma.classPeriod.delete({ where: { id } });
    return { message: 'Periodo de clase eliminado correctamente' };
  }
}
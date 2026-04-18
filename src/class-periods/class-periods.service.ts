import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassPeriodsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    // Retornamos todos los periodos ordenados lógicamente (1, 2, 3...)
    return this.prisma.classPeriod.findMany({
      orderBy: { order: 'asc' },
    });
  }

  // Método rápido para inicializar las horas si la tabla está vacía
  async seedDefaultPeriods() {
    const count = await this.prisma.classPeriod.count();
    if (count > 0) return { message: 'Los periodos ya existen' };

    const defaults = [
      { name: '1ra Hora', startTime: '08:00', endTime: '08:40', shift: 'MANANA' as any, isBreak: false, order: 1 },
      { name: '2da Hora', startTime: '08:40', endTime: '09:20', shift: 'MANANA' as any, isBreak: false, order: 2 },
      { name: 'Recreo', startTime: '09:20', endTime: '09:40', shift: 'MANANA' as any, isBreak: true, order: 3 },
      { name: '3ra Hora', startTime: '09:40', endTime: '10:20', shift: 'MANANA' as any, isBreak: false, order: 4 },
    ];

    await this.prisma.classPeriod.createMany({ data: defaults });
    return { message: 'Periodos base creados exitosamente' };
  }
}
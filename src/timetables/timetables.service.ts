import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleSlotDto } from './dto/create-schedule-slot.dto';
import { Shift } from '../../prisma/generated/client';
import { Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { renderToStream } from '@react-pdf/renderer';
import { TimetableTemplate } from './templates/timetable.template';
import React from 'react';

@Injectable()
export class TimetablesService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('export-queue') private exportQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.seedMorningPeriods();
  }

  async getPeriods(shift: Shift) {
    return this.prisma.classPeriod.findMany({
      where: { shift },
      orderBy: { order: 'asc' },
    });
  }

  async getClassroomSchedule(classroomId: string) {
    return this.prisma.scheduleSlot.findMany({
      where: { classroomId },
      include: {
        teacherAssignment: {
          include: {
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, fullName: true } },
          },
        },
        // 🔥 TRAEMOS EL ESPACIO FÍSICO
        physicalSpace: { select: { id: true, name: true } },
      },
    });
  }

  async createSlot(data: CreateScheduleSlotDto) {
    const teacherConflict = await this.prisma.scheduleSlot.findFirst({
      where: {
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        classPeriodId: data.classPeriodId,
      },
      include: { classroom: { select: { grade: true, section: true } } },
    });

    if (teacherConflict)
      throw new ConflictException(
        `Choque de Horario con ${teacherConflict.classroom.grade} "${teacherConflict.classroom.section}".`,
      );

    try {
      return await this.prisma.scheduleSlot.create({ data });
    } catch (error: any) {
      if (error.code === 'P2002')
        throw new ConflictException(
          'Este curso ya tiene una materia asignada en este periodo.',
        );
      throw error;
    }
  }

  async removeSlot(id: string) {
    const slot = await this.prisma.scheduleSlot.findUnique({ where: { id } });
    if (!slot) throw new NotFoundException('Casillero no encontrado');
    await this.prisma.scheduleSlot.delete({ where: { id } });
    return { message: 'Casillero liberado exitosamente' };
  }

  async exportSinglePdf(classroomId: string, res: Response) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { academicYear: true },
    });
    if (!classroom) throw new NotFoundException('Curso no encontrado');

    const periods = await this.getPeriods(classroom.shift);
    const slots = await this.getClassroomSchedule(classroomId);

    // 🔥 2. Generamos el stream del PDF de forma nativa
    const pdfStream = await renderToStream(
      React.createElement(TimetableTemplate, { classroom, periods, slots }),
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Horario_${classroom.grade}_${classroom.section}.pdf"`,
    });

    // 3. Enviamos el stream al cliente (Súper eficiente en memoria)
    pdfStream.pipe(res);
  }

  async requestMassiveZip(academicYearId: string) {
    await this.exportQueue.add('generate-massive-zip', { academicYearId });
    return {
      message: 'Generación iniciada en segundo plano.',
      status: 'processing',
    };
  }

  async downloadZip(fileName: string, res: Response) {
    const filePath = path.join(process.cwd(), 'temp-exports', fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('El archivo ya no existe o expiró.');
    }
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  private async seedMorningPeriods() {
    const existing = await this.prisma.classPeriod.count({
      where: { shift: Shift.MANANA },
    });
    if (existing > 0) return;
    const periods = [
      {
        name: '1er Periodo',
        startTime: '08:00',
        endTime: '08:40',
        shift: Shift.MANANA,
        isBreak: false,
        order: 1,
      },
      {
        name: '2do Periodo',
        startTime: '08:40',
        endTime: '09:20',
        shift: Shift.MANANA,
        isBreak: false,
        order: 2,
      },
      {
        name: '1er Recreo',
        startTime: '09:20',
        endTime: '09:30',
        shift: Shift.MANANA,
        isBreak: true,
        order: 3,
      },
      {
        name: '3er Periodo',
        startTime: '09:30',
        endTime: '10:10',
        shift: Shift.MANANA,
        isBreak: false,
        order: 4,
      },
      {
        name: '4to Periodo',
        startTime: '10:10',
        endTime: '10:50',
        shift: Shift.MANANA,
        isBreak: false,
        order: 5,
      },
      {
        name: '2do Recreo',
        startTime: '10:50',
        endTime: '11:00',
        shift: Shift.MANANA,
        isBreak: true,
        order: 6,
      },
      {
        name: '5to Periodo',
        startTime: '11:00',
        endTime: '11:40',
        shift: Shift.MANANA,
        isBreak: false,
        order: 7,
      },
      {
        name: '6to Periodo',
        startTime: '11:40',
        endTime: '12:20',
        shift: Shift.MANANA,
        isBreak: false,
        order: 8,
      },
      {
        name: '7mo Periodo',
        startTime: '12:20',
        endTime: '13:00',
        shift: Shift.MANANA,
        isBreak: false,
        order: 9,
      },
      {
        name: '8vo Periodo',
        startTime: '13:00',
        endTime: '13:40',
        shift: Shift.MANANA,
        isBreak: false,
        order: 10,
      },
    ];
    await this.prisma.classPeriod.createMany({ data: periods });
  }

  async updateSlotSpace(id: string, physicalSpaceId: string | null) {
    const slot = await this.prisma.scheduleSlot.findUnique({ where: { id } });
    if (!slot) throw new NotFoundException('Casillero no encontrado');

    return this.prisma.scheduleSlot.update({
      where: { id },
      data: { physicalSpaceId },
    });
  }
}

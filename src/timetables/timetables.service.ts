import {
  Injectable,
  NotFoundException,
  ConflictException,
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
export class TimetablesService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('export-queue') private exportQueue: Queue,
  ) {}

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
        physicalSpace: { select: { id: true, name: true } },
      },
    });
  }

  async createSlot(data: CreateScheduleSlotDto) {
    const [assignment, period, institution] = await Promise.all([
      this.prisma.teacherAssignment.findUnique({
        where: { id: data.teacherAssignmentId },
        include: {
          classroom: true,
          teacher: { select: { fullName: true } },
          subject: { select: { name: true } },
        },
      }),
      this.prisma.classPeriod.findUnique({ where: { id: data.classPeriodId } }),
      this.prisma.institution.findFirst(),
    ]);

    if (!assignment)
      throw new NotFoundException('Asignación docente no encontrada.');
    if (!period) throw new NotFoundException('Periodo de clase no encontrado.');
    if (!institution)
      throw new NotFoundException('Configuración institucional no encontrada.');

    if (
      data.classroomId !== assignment.classroomId ||
      data.teacherId !== assignment.teacherId
    ) {
      throw new ConflictException(
        'Inconsistencia de datos: El docente o curso no coinciden con la asignación oficial.',
      );
    }

    if (assignment.classroom.shift !== period.shift) {
      throw new ConflictException(
        `Incompatibilidad de turno: El curso es del turno ${assignment.classroom.shift}, pero el periodo es de la ${period.shift}.`,
      );
    }

    let finalSpaceId: string | null | undefined = data.physicalSpaceId;
    const subjectName = assignment.subject.name.toLowerCase();
    const isSpecialSubject =
      subjectName.includes('educación física') ||
      subjectName.includes('educacion fisica');

    if (institution.schedulingMode === 'FIXED_BASE') {
      if (!isSpecialSubject) {
        finalSpaceId = assignment.classroom.baseRoomId;

        if (
          data.physicalSpaceId &&
          data.physicalSpaceId !== assignment.classroom.baseRoomId
        ) {
          throw new ConflictException(
            `En el modo 'Aula Fija', la materia de ${assignment.subject.name} no tiene permitido cambiar de espacio físico.`,
          );
        }
      }
    } else if (institution.schedulingMode === 'DYNAMIC') {
      if (!finalSpaceId) {
        throw new ConflictException(
          'En modo DINÁMICO es estrictamente obligatorio asignar un espacio físico (Aula/Lab).',
        );
      }
    }

    if (finalSpaceId) {
      const spaceConflict = await this.prisma.scheduleSlot.findFirst({
        where: {
          physicalSpaceId: finalSpaceId,
          dayOfWeek: data.dayOfWeek,
          classPeriodId: data.classPeriodId,
        },
        include: { physicalSpace: true, classroom: true },
      });

      if (spaceConflict) {
        const spaceName =
          spaceConflict.physicalSpace?.name || 'El espacio seleccionado';
        throw new ConflictException(
          `Choque de Espacio: "${spaceName}" ya está reservado para ${spaceConflict.classroom.grade} "${spaceConflict.classroom.section}".`,
        );
      }
    }

    const teacherConflict = await this.prisma.scheduleSlot.findFirst({
      where: {
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        classPeriodId: data.classPeriodId,
      },
      include: { classroom: true },
    });

    if (teacherConflict) {
      throw new ConflictException(
        `Choque de Docente: El Prof. ${assignment.teacher.fullName} ya dicta clases en ${teacherConflict.classroom.grade} "${teacherConflict.classroom.section}" a esta hora.`,
      );
    }

    try {
      return await this.prisma.scheduleSlot.create({
        data: {
          dayOfWeek: data.dayOfWeek,
          classPeriodId: data.classPeriodId,
          teacherAssignmentId: data.teacherAssignmentId,
          classroomId: assignment.classroomId,
          teacherId: assignment.teacherId,
          physicalSpaceId: finalSpaceId,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Este curso ya tiene una materia asignada en este horario específico.',
        );
      }
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

    const pdfStream = await renderToStream(
      React.createElement(TimetableTemplate, { classroom, periods, slots }),
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Horario_${classroom.grade}_${classroom.section}.pdf"`,
    });

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

  async updateSlotSpace(id: string, physicalSpaceId: string | null) {
    const slot = await this.prisma.scheduleSlot.findUnique({
      where: { id },
      include: {
        teacherAssignment: { include: { subject: true } },
        classroom: true,
      },
    });

    if (!slot) throw new NotFoundException('Casillero no encontrado');

    const institution = await this.prisma.institution.findFirst();
    if (!institution)
      throw new NotFoundException('Configuración institucional no encontrada.');

    const subjectName = slot.teacherAssignment.subject.name.toLowerCase();
    const isSpecialSubject =
      subjectName.includes('educación física') ||
      subjectName.includes('educacion fisica');

    if (institution.schedulingMode === 'FIXED_BASE' && !isSpecialSubject) {
      throw new ConflictException(
        `Acción denegada: En modo 'Aula Fija', no puedes mover la materia de ${slot.teacherAssignment.subject.name} a otro espacio físico.`,
      );
    }

    if (physicalSpaceId) {
      const spaceConflict = await this.prisma.scheduleSlot.findFirst({
        where: {
          physicalSpaceId: physicalSpaceId,
          dayOfWeek: slot.dayOfWeek,
          classPeriodId: slot.classPeriodId,
          id: { not: id },
        },
        include: { physicalSpace: true, classroom: true },
      });

      if (spaceConflict) {
        const spaceName =
          spaceConflict.physicalSpace?.name || 'El espacio seleccionado';
        throw new ConflictException(
          `Choque de Espacio: "${spaceName}" ya está reservado para ${spaceConflict.classroom.grade} "${spaceConflict.classroom.section}".`,
        );
      }
    }

    return this.prisma.scheduleSlot.update({
      where: { id },
      data: { physicalSpaceId },
    });
  }
}

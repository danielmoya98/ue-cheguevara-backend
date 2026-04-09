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
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TimetablesService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    // Inyectamos la cola
    @InjectQueue('export-queue') private exportQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.seedMorningPeriods();
  }

  // ==============================================
  // 1. ENDPOINTS DE LA CUADRÍCULA
  // ==============================================

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

  // ==============================================
  // 2. EXPORTACIÓN INDIVIDUAL (Síncrona)
  // ==============================================

  async exportSinglePdf(classroomId: string, res: Response) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { academicYear: true },
    });
    if (!classroom) throw new NotFoundException('Curso no encontrado');

    const periods = await this.getPeriods(classroom.shift);
    const slots = await this.getClassroomSchedule(classroomId);

    let tableRowsHtml = '';
    for (const p of periods) {
      tableRowsHtml += `<tr><td class="${p.isBreak ? 'break-time' : 'time-cell'}"><strong>${p.name}</strong><br/><span style="font-size: 10px; color: #555;">${p.startTime} - ${p.endTime}</span></td>`;
      for (let day = 1; day <= 5; day++) {
        if (p.isBreak) {
          tableRowsHtml += `<td class="break-cell">${day === 3 ? 'R E C R E O' : ''}</td>`;
        } else {
          const slot = slots.find(
            (s) => s.dayOfWeek === day && s.classPeriodId === p.id,
          );
          if (slot) {
            const parts = slot.teacherAssignment.teacher.fullName.split(' ');
            const name =
              parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0];
            tableRowsHtml += `<td class="slot-cell"><strong>${slot.teacherAssignment.subject.name}</strong><br/><span style="font-size: 10px;">Prof. ${name}</span></td>`;
          } else {
            tableRowsHtml += `<td class="slot-cell"></td>`;
          }
        }
      }
      tableRowsHtml += `</tr>`;
    }

    const htmlContent = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 20px; } .title { font-size: 22px; font-weight: 900; margin: 0; }
        .subtitle { font-size: 16px; font-weight: bold; margin: 5px 0; color: #2563eb; } .info { font-size: 12px; color: #666; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; } th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: center; }
        th { background-color: #1e3a8a; color: white; font-size: 12px; } .time-cell { background-color: #f8fafc; font-size: 12px; width: 120px; }
        .break-time { background-color: #e2e8f0; font-size: 12px; width: 120px; color: #64748b; } .break-cell { background-color: #f1f5f9; color: #94a3b8; font-weight: 900; letter-spacing: 3px; font-size: 14px; }
        .slot-cell { font-size: 12px; background-color: #ffffff; }
      </style></head><body>
        <div class="header"><h1 class="title">UNIDAD EDUCATIVA "ERNESTO CHE GUEVARA"</h1><h2 class="subtitle">HORARIO ESCOLAR - ${classroom.grade} "${classroom.section}" (${classroom.level})</h2><p class="info">Turno: ${classroom.shift} | Gestión: ${classroom.academicYear.year}</p></div>
        <table><thead><tr><th>PERIODO</th><th>LUNES</th><th>MARTES</th><th>MIÉRCOLES</th><th>JUEVES</th><th>VIERNES</th></tr></thead><tbody>${tableRowsHtml}</tbody></table>
      </body></html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });
    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Horario_${classroom.grade}_${classroom.section}.pdf"`,
      'Content-Length': pdf.length.toString(),
    });
    res.end(Buffer.from(pdf));
  }

  // ==============================================
  // 3. EXPORTACIÓN MASIVA (Asíncrona via BullMQ)
  // ==============================================

  async requestMassiveZip(academicYearId: string) {
    // Añadimos a la cola
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

  // ==============================================
  // SEEDER
  // ==============================================
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
}

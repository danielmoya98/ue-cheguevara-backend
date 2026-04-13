import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TimetablesGateway } from './timetables.gateway';
import * as fs from 'fs';
import * as path from 'path';
const archiver = require('archiver');

// 🔥 1. Importaciones de React-PDF
import { renderToBuffer } from '@react-pdf/renderer';
import { TimetableTemplate } from './templates/timetable.template';
import React from 'react';

@Processor('export-queue')
export class TimetablesProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private gateway: TimetablesGateway,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'generate-massive-zip') {
      return this.handleMassiveZip(job.data);
    }
  }

  private async handleMassiveZip(data: { academicYearId: string }) {
    console.log(
      '👷‍♂️ [WORKER] Iniciando generación masiva de PDFs de forma nativa...',
    );
    const { academicYearId } = data;

    const classrooms = await this.prisma.classroom.findMany({
      where: { academicYearId },
    });

    const exportsDir = path.join(process.cwd(), 'temp-exports');
    if (!fs.existsSync(exportsDir))
      fs.mkdirSync(exportsDir, { recursive: true });

    const zipFileName = `Horarios_${academicYearId}_${Date.now()}.zip`;
    const zipFilePath = path.join(exportsDir, zipFileName);

    const output = fs.createWriteStream(zipFilePath);
    const createArchive = archiver.default || archiver;
    const archive = createArchive('zip', { zlib: { level: 9 } });

    const archivePromise = new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    archive.pipe(output);

    // 🔥 2. Bucle limpio y ultra-rápido sin Puppeteer
    for (const classroom of classrooms) {
      const pdfBuffer = await this.generatePdfBuffer(classroom.id);
      const fileName = `${classroom.level}/${classroom.grade}_${classroom.section}.pdf`;
      archive.append(pdfBuffer, { name: fileName });
    }

    await archive.finalize();
    await archivePromise;

    console.log(`✅ [WORKER] ZIP generado con éxito: ${zipFileName}`);
    this.gateway.notifyExportComplete(academicYearId, zipFileName);
  }

  // 🔥 3. Generador optimizado
  private async generatePdfBuffer(classroomId: string): Promise<Buffer> {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { academicYear: true },
    });

    if (!classroom)
      throw new Error(`Curso con ID ${classroomId} no encontrado en la DB`);

    const periods = await this.prisma.classPeriod.findMany({
      where: { shift: classroom.shift },
      orderBy: { order: 'asc' },
    });

    const slots = await this.prisma.scheduleSlot.findMany({
      where: { classroomId },
      include: {
        teacherAssignment: { include: { subject: true, teacher: true } },
        physicalSpace: true, // 🔥 Aseguramos traer el espacio físico
      },
    });

    // Renderizamos el componente de React directamente a Buffer de memoria
    return await renderToBuffer(
      React.createElement(TimetableTemplate, { classroom, periods, slots }),
    );
  }
}

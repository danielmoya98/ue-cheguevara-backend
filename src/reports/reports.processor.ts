import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';

// 🔥 FIX 1: Importación correcta para librerías CommonJS en NestJS
const archiver = require('archiver');

// Importamos tu componente React-PDF
import { BolivianLibreta } from './templates/BolivianLibreta';
import { TimetablesGateway } from '../timetables/timetables.gateway';

@Processor('reports-queue')
export class ReportsProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
    private gateway: TimetablesGateway,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'generate-massive-bulletins') {
      return this.handleMassiveBulletins(job.data);
    }
  }

  private async handleMassiveBulletins(data: {
    academicYearId: string;
    classroomId?: string;
    userId: string;
  }) {
    console.log(
      '👷‍♂️ [WORKER] Iniciando generación masiva de Libretas (Ley 070)...',
    );
    const { academicYearId, classroomId, userId } = data;

    // 1. Buscamos a todos los inscritos
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        academicYearId,
        ...(classroomId ? { classroomId } : {}),
        status: 'INSCRITO',
      },
      include: {
        classroom: true,
        student: true,
      },
    });

    if (enrollments.length === 0) {
      console.log('⚠️ [WORKER] No hay inscritos para procesar.');
      return;
    }

    // 2. Preparamos el Archiver (ZIP)
    const exportsDir = path.join(process.cwd(), 'temp-exports');
    if (!fs.existsSync(exportsDir))
      fs.mkdirSync(exportsDir, { recursive: true });

    const zipFileName = `Libretas_${classroomId ? 'Curso' : 'Colegio'}_${Date.now()}.zip`;
    const zipFilePath = path.join(exportsDir, zipFileName);

    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const archivePromise = new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    archive.pipe(output);

    // 3. Generamos PDFs en Bucle
    for (const enrollment of enrollments) {
      try {
        // Obtenemos los datos pivoteados
        const bulletinData =
          await this.reportsService.getIndividualBulletinData(enrollment.id);

        // 🔥 FIX 2: Añadimos 'as any' para bypasear la restricción estricta de React-PDF
        const pdfBuffer = await renderToBuffer(
          React.createElement(BolivianLibreta, { data: bulletinData }) as any,
        );

        // Limpiamos el nombre para que los archivos no fallen en Windows/Linux
        const safeName =
          `${enrollment.student.lastNamePaterno}_${enrollment.student.names}`.replace(
            /[^a-zA-Z0-9]/g,
            '_',
          );
        const folderName = `${enrollment.classroom.grade}_${enrollment.classroom.section}`;
        const fileName = `Libreta_${safeName}.pdf`;

        archive.append(pdfBuffer, { name: `${folderName}/${fileName}` });
      } catch (error) {
        console.error(
          `❌ Error procesando libreta para matrícula ${enrollment.id}:`,
          error,
        );
      }
    }

    await archive.finalize();
    await archivePromise;

    console.log(
      `✅ [WORKER] ZIP de Libretas generado con éxito: ${zipFileName}`,
    );

    // 4. Avisar al Director/Admin vía WebSocket
    this.gateway.notifyExportComplete(academicYearId, zipFileName);
  }
}

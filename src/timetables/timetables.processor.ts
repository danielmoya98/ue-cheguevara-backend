import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TimetablesGateway } from './timetables.gateway';
// 🔥 FIX 1: Importamos explícitamente el tipo 'Browser' de Puppeteer
import puppeteer, { Browser } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const archiver = require('archiver');

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
    console.log('👷‍♂️ [WORKER] Iniciando generación masiva de PDFs...');
    const { academicYearId } = data;

    const classrooms = await this.prisma.classroom.findMany({
      where: { academicYearId },
    });

    // 1. Crear carpeta temporal en el servidor si no existe
    const exportsDir = path.join(process.cwd(), 'temp-exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // 2. Archivo ZIP de destino
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

    // Arrancamos 1 solo navegador para reciclarlo y ahorrar RAM
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // 3. Generamos los PDFs
    for (const classroom of classrooms) {
      const pdfBuffer = await this.generatePdfBuffer(classroom.id, browser);
      const fileName = `${classroom.level}/${classroom.grade}_${classroom.section}.pdf`;
      archive.append(pdfBuffer, { name: fileName });
    }

    await browser.close();
    await archive.finalize();
    await archivePromise;

    console.log(`✅ [WORKER] ZIP generado con éxito: ${zipFileName}`);

    // 4. Avisar al Frontend
    this.gateway.notifyExportComplete(academicYearId, zipFileName);
  }

  // Generador HTML a PDF optimizado para el Worker
  private async generatePdfBuffer(
    classroomId: string,
    browser: Browser, // Usamos la interfaz importada
  ): Promise<Buffer> {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { academicYear: true },
    });

    // 🔥 FIX 2: Le garantizamos a TypeScript que abortaremos si el curso no existe
    if (!classroom) {
      throw new Error(`Curso con ID ${classroomId} no encontrado en la DB`);
    }

    const periods = await this.prisma.classPeriod.findMany({
      where: { shift: classroom.shift },
      orderBy: { order: 'asc' },
    });

    const slots = await this.prisma.scheduleSlot.findMany({
      where: { classroomId },
      include: {
        teacherAssignment: {
          include: { subject: true, teacher: true },
        },
      },
    });

    let tableRowsHtml = '';
    for (const p of periods) {
      tableRowsHtml += `<tr><td class="${
        p.isBreak ? 'break-time' : 'time-cell'
      }"><strong>${p.name}</strong><br/><span style="font-size: 10px; color: #555;">${
        p.startTime
      } - ${p.endTime}</span></td>`;
      for (let day = 1; day <= 5; day++) {
        if (p.isBreak) {
          tableRowsHtml += `<td class="break-cell">${
            day === 3 ? 'R E C R E O' : ''
          }</td>`;
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

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });
    await page.close();
    return Buffer.from(pdf);
  }
}

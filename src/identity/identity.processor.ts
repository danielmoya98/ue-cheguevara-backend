import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from './identity.service';
import { IdentityGateway } from './identity.gateway';
import * as fs from 'fs';
import * as path from 'path';
import { renderToBuffer } from '@react-pdf/renderer';
import { CarnetTemplate } from './templates/carnet.template';
import React from 'react';
const archiver = require('archiver');

@Processor('export-queue')
export class IdentityProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private identityService: IdentityService,
    private gateway: IdentityGateway,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'generate-massive-carnets') {
      return this.handleMassiveCarnets(job.data);
    }
  }

  private async handleMassiveCarnets(data: { academicYearId: string; level?: any; classroomId?: string }) {
    console.log('🪪 [WORKER] Iniciando generación de Carnets PVC...');
    const { academicYearId, level, classroomId } = data;

    // Obtenemos solo los inscritos activos
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        academicYearId,
        status: 'INSCRITO',
        classroom: {
          id: classroomId || undefined,
          level: level || undefined,
        },
      },
      include: { student: true, classroom: true, academicYear: true },
    });

    const exportsDir = path.join(process.cwd(), 'temp-exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

    const zipFileName = `Lote_Carnets_${Date.now()}.zip`;
    const zipFilePath = path.join(exportsDir, zipFileName);

    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const archivePromise = new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    archive.pipe(output);

    // Iteramos, generamos QR y luego PDF a Buffer
    for (const enrollment of enrollments) {
      try {
        // 🔥 CORRECCIÓN: Usamos la nueva lógica de seguridad
        let qrResponse = await this.identityService.getStudentQR(enrollment.student.id);

        // Si el alumno no tiene carnet activo, el sistema lo genera automáticamente para el lote
        if (!qrResponse.isActive) {
          qrResponse = await this.identityService.generateNewQR(enrollment.student.id);
        }

        const qrBase64 = qrResponse.qr;
        
        const pdfBuffer = await renderToBuffer(
          React.createElement(CarnetTemplate, { 
            student: enrollment.student, 
            enrollment, 
            qrBase64 
          })
        );

        // Carpeta interna en el ZIP: Nivel / Curso_Paralelo / Apellido_Nombre.pdf
        const folderName = `${enrollment.classroom.level}/${enrollment.classroom.grade}_${enrollment.classroom.section}`;
        const fileName = `${enrollment.student.lastNamePaterno}_${enrollment.student.names}_${enrollment.student.ci || 'SN'}.pdf`;
        
        archive.append(pdfBuffer, { name: `${folderName}/${fileName}` });
      } catch (error) {
        console.error(`Error generando carnet para ${enrollment.student.id}`, error);
      }
    }

    await archive.finalize();
    await archivePromise;

    console.log(`✅ [WORKER] Lote de Carnets ZIP generado: ${zipFileName}`);
    this.gateway.notifyExportComplete(academicYearId, zipFileName);
  }
}
// src/reports/reports.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('reports-queue') private reportsQueue: Queue, // Inyectamos BullMQ
  ) {}

  // 1. Obtener Datos Estructurados para una Sola Libreta
  async getIndividualBulletinData(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: true,
        academicYear: true,
        classroom: true,
        grades: {
          include: {
            teacherAssignment: { include: { subject: true } },
            trimester: true,
          },
        },
      },
    });

    if (!enrollment) throw new NotFoundException('Inscripción no encontrada');

    // Obtenemos los datos globales del colegio
    const institution = await this.prisma.institution.findFirst();

    // PIVOTEAR DATOS: Agrupar por "Área/Campo" (Ej. Vida Tierra Territorio)
    const camposMap = new Map<string, any>();

    for (const grade of enrollment.grades) {
      // Excluir notas borrador
      if (grade.status === 'DRAFT') continue;

      // Si el subject no tiene área, lo metemos en un grupo genérico
      const areaName = grade.teacherAssignment.subject.area || 'OTROS CAMPOS';
      const subjectName = grade.teacherAssignment.subject.name;

      if (!camposMap.has(areaName)) {
        camposMap.set(areaName, { areaName, asignaturasMap: new Map() });
      }

      const campo = camposMap.get(areaName);

      if (!campo.asignaturasMap.has(subjectName)) {
        campo.asignaturasMap.set(subjectName, {
          name: subjectName,
          t1: null,
          t2: null,
          t3: null,
        });
      }

      const asignatura = campo.asignaturasMap.get(subjectName);

      if (grade.trimester.name === 'PRIMER_TRIMESTRE')
        asignatura.t1 = grade.finalScore;
      if (grade.trimester.name === 'SEGUNDO_TRIMESTRE')
        asignatura.t2 = grade.finalScore;
      if (grade.trimester.name === 'TERCER_TRIMESTRE')
        asignatura.t3 = grade.finalScore;
    }

    // Convertir Maps a Arrays y calcular Promedio Anual
    const camposArray = Array.from(camposMap.values()).map((campo) => {
      const asignaturasArray = Array.from(campo.asignaturasMap.values()).map(
        (asig: any) => {
          let suma = 0;
          let divisor = 0;
          if (asig.t1) {
            suma += asig.t1;
            divisor++;
          }
          if (asig.t2) {
            suma += asig.t2;
            divisor++;
          }
          if (asig.t3) {
            suma += asig.t3;
            divisor++;
          }

          // Redondeo comercial clásico
          asig.promedioAnual = divisor > 0 ? Math.round(suma / divisor) : null;
          return asig;
        },
      );

      return {
        areaName: campo.areaName,
        asignaturas: asignaturasArray,
      };
    });

    return {
      student: enrollment.student,
      institution,
      academicYear: enrollment.academicYear,
      classroom: enrollment.classroom,
      campos: camposArray,
    };
  }

  // 2. Encolar la petición masiva (Se ejecutará en segundo plano)
  async queueMassiveBulletins(payload: {
    academicYearId: string;
    classroomId?: string;
    userId: string;
  }) {
    // Agregamos el trabajo a la cola de Redis
    const job = await this.reportsQueue.add('generate-massive-bulletins', {
      academicYearId: payload.academicYearId,
      classroomId: payload.classroomId,
      userId: payload.userId, // Para notificar a este usuario por WebSockets luego
    });

    return {
      success: true,
      message: 'La generación masiva ha comenzado en segundo plano.',
      jobId: job.id,
    };
  }
}

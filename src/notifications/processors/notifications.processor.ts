import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service'; // Ajusta la ruta a tu módulo
import { PrismaService } from '../../prisma/prisma.service';

@Processor('notifications-queue') // 🔥 Nombre de la cola
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'grade-alert':
        return this.handleGradeAlert(job.data);
      default:
        this.logger.warn(`Trabajo desconocido detectado: ${job.name}`);
    }
  }

  private async handleGradeAlert(data: { enrollmentId: string; subjectName: string; finalScore: number }) {
    this.logger.log(`Procesando alerta de calificación para inscripción: ${data.enrollmentId}`);

    // 1. Buscamos al estudiante y los tokens FCM de sus padres (Guardians)
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: data.enrollmentId },
      include: {
        student: {
          include: {
            guardians: {
              include: {
                guardian: {
                  include: { user: true } // Necesitamos el usuario del padre para sacar el fcmToken
                }
              }
            }
          }
        }
      }
    });

    if (!enrollment) throw new Error('Inscripción no encontrada para la alerta');

    // 2. Extraemos todos los tokens de los padres vinculados
    const tokens: string[] = [];
    enrollment.student.guardians.forEach((sg) => {
      if (sg.guardian.user?.fcmTokens && sg.guardian.user.fcmTokens.length > 0) {
        tokens.push(...sg.guardian.user.fcmTokens);
      }
    });

    if (tokens.length === 0) {
      this.logger.log(`No hay dispositivos registrados para los padres del alumno ${enrollment.student.names}. Omitiendo Push.`);
      return;
    }

    // 3. Construimos el mensaje crítico
    const title = '⚠️ Alerta de Rendimiento Académico';
    const body = `${enrollment.student.names} ha registrado una calificación de ${data.finalScore} puntos en la materia de ${data.subjectName}. Se requiere atención.`;

    // 4. Disparamos a Firebase
    await this.firebaseService.sendMulticastNotification(tokens, title, body, {
      type: 'GRADE_ALERT',
      enrollmentId: data.enrollmentId,
    });

    this.logger.log(`Alerta enviada con éxito a ${tokens.length} dispositivos.`);
  }
}
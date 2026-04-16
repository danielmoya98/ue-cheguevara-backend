import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  constructor() {
    // Inicializamos Firebase SOLO si no ha sido inicializado antes
    if (!admin.apps.length) {
      try {
        // 🔥 Buscamos la ruta absoluta desde la raíz del proyecto (process.cwd())
        // Esto evita el error de "Cannot find module" cuando NestJS compila a la carpeta /dist
        const serviceAccountPath = path.join(
          process.cwd(),
          'firebase-credentials.json',
        );

        // Verificamos si el archivo realmente existe antes de intentar leerlo
        if (!fs.existsSync(serviceAccountPath)) {
          this.logger.error(
            `No se encontró el archivo de credenciales en: ${serviceAccountPath}`,
          );
          return;
        }

        // Leemos el JSON de forma segura con fs
        const serviceAccount = JSON.parse(
          fs.readFileSync(serviceAccountPath, 'utf8'),
        );

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        this.logger.log('🔥 Firebase Admin inicializado correctamente');
      } catch (error) {
        this.logger.error('Error al inicializar Firebase Admin', error);
      }
    }
  }

  async sendMulticastNotification(
    tokens: string[],
    title: string,
    body: string,
    dataPayload?: Record<string, string>,
  ) {
    if (!tokens || tokens.length === 0) return null;

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: tokens,
        notification: { title, body },
        data: dataPayload,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'high_importance_channel',
          },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(
        `Push FCM -> Éxitos: ${response.successCount}, Fallos: ${response.failureCount}`,
      );

      return response;
    } catch (error) {
      this.logger.error('Error enviando notificación Push', error);
      throw error;
    }
  }
}

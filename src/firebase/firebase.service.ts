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
        const serviceAccountPath = path.join(
          process.cwd(),
          'firebase-credentials.json',
        );

        if (!fs.existsSync(serviceAccountPath)) {
          this.logger.error(
            `No se encontró el archivo de credenciales en: ${serviceAccountPath}`,
          );
          return;
        }

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

      // 🔥 EL RADAR: Extraemos el motivo exacto del fallo
      if (response.failureCount > 0) {
        this.logger.warn(`⚠️ Detalles de los fallos de Firebase:`);
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            // Imprimimos el inicio del token y el código de error de Google
            const tokenSnippet = tokens[idx].substring(0, 15) + '...';
            this.logger.error(`❌ Token [${tokenSnippet}]: ${resp.error?.code || resp.error?.message}`);
          }
        });
      }

      return response;
    } catch (error) {
      this.logger.error('Error enviando notificación Push', error);
      throw error;
    }
  }
}
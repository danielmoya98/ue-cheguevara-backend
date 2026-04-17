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

        // 1. INTENTO LOCAL: Buscar el archivo físico (Ideal para desarrollo en tu PC)
        if (fs.existsSync(serviceAccountPath)) {
          const serviceAccount = JSON.parse(
            fs.readFileSync(serviceAccountPath, 'utf8'),
          );

          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          this.logger.log('🔥 Firebase Admin inicializado mediante archivo JSON');
        
        // 2. FALLBACK PRODUCCIÓN: Usar variables de entorno (Ideal para Render)
        } else if (process.env.FIREBASE_PROJECT_ID) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              // IMPORTANTE: Render rompe los saltos de línea. Esto los vuelve a arreglar:
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
          });
          this.logger.log('🔥 Firebase Admin inicializado mediante Variables de Entorno');
        
        } else {
          this.logger.error(
            'CRÍTICO: No se encontró el archivo JSON ni las Variables de Entorno de Firebase.',
          );
          return;
        }
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
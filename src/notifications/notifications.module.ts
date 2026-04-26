import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsProcessor } from './processors/notifications.processor';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [
    FirebaseModule,
    // Registramos la cola en BullMQ
    BullModule.registerQueue({
      name: 'notifications-queue',
      defaultJobOptions: {
        attempts: 3, // 🔥 Reintentará 3 veces si Firebase falla
        backoff: {
          type: 'exponential',
          delay: 5000, // Espera 5s, luego 25s, luego 125s...
        },
        removeOnComplete: true, // Limpia la RAM cuando termina
      },
    }),
  ],
  providers: [NotificationsProcessor],
  exports: [BullModule], // Lo exportamos para que GradesService pueda inyectar la cola
})
export class NotificationsModule {}
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq'; // 🔥 Necesario para la cola de notificaciones
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';
import { PrismaModule } from '../prisma/prisma.module'; // 🔥 Necesario para la DB

@Module({
  imports: [
    // 1. Conexión a la Base de Datos
    PrismaModule,

    // 2. Registro de la cola para que el Service pueda inyectarla
    // Esto resuelve el error "BullQueue_notifications-queue"
    BullModule.registerQueue({
      name: 'notifications-queue',
    }),
  ],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService], // Exportamos por si otros módulos necesitan consultar notas
})
export class GradesModule {}

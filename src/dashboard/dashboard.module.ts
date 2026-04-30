import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module'; // Asegúrate de que la ruta sea correcta

@Module({
  imports: [PrismaModule], // 🔥 Súper importante para que funcione this.prisma
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

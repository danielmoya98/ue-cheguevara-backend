import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module'; 
import { AttendanceCronService } from './attendance.cron';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceCronService],
  exports: [AttendanceService], // 🔥 Corregido: Faltaba el corchete aquí
})
export class AttendanceModule {}
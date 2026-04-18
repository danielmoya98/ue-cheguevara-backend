import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module'; // Importamos Identity para usar el validador QR
import { AttendanceCronService } from './attendance.cron';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService, AttendanceCronService],
})
export class AttendanceModule {}
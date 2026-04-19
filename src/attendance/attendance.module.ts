import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module'; 
import { AttendanceCronService } from './attendance.cron';
import { FirebaseModule } from '../firebase/firebase.module'; // 🔥 IMPORTANTE

@Module({
  imports: [PrismaModule, IdentityModule ,FirebaseModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceCronService],
  exports: [AttendanceService], // 🔥 Corregido: Faltaba el corchete aquí
})
export class AttendanceModule {}
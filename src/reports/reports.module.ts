// src/reports/reports.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsProcessor } from './reports.processor'; // 🔥 No olvides registrar el Worker
import { PrismaModule } from '../prisma/prisma.module';
import { TimetablesModule } from '../timetables/timetables.module';

@Module({
  imports: [
    PrismaModule,
    TimetablesModule,
    BullModule.registerQueue({
      name: 'reports-queue',
    }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsProcessor],
  exports: [ReportsService],
})
export class ReportsModule {}

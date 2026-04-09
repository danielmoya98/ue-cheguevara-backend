import { Module } from '@nestjs/common';
import { TimetablesService } from './timetables.service';
import { TimetablesController } from './timetables.controller';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { TimetablesProcessor } from './timetables.processor';
import { TimetablesGateway } from './timetables.gateway';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [
    PrismaModule,
    // Registramos la cola específica para este módulo
    BullModule.registerQueue({
      name: 'export-queue',
    }),
  ],
  controllers: [TimetablesController],
  providers: [
    TimetablesService,
    TimetablesProcessor,
    TimetablesGateway,
    CleanupService,
  ],
})
export class TimetablesModule {}

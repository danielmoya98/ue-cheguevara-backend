import { Module } from '@nestjs/common';
import { ClassPeriodsService } from './class-periods.service';
import { ClassPeriodsController } from './class-periods.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClassPeriodsController],
  providers: [ClassPeriodsService],
})
export class ClassPeriodsModule {}
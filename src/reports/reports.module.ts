import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsGateway } from './gateways/reports/reports.gateway';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsGateway],
})
export class ReportsModule {}

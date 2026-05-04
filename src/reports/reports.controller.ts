// src/reports/reports.controller.ts
import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { PermissionsGuard } from '../auth/guards/permissions.guard';
// import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Descarga el JSON estructurado para 1 estudiante
  @Get('bulletin/:enrollmentId')
  // @UseGuards(JwtAuthGuard, PermissionsGuard)
  // @Permissions('read:any:Grade') // 🔒 Ajusta tu regla ABAC
  async getIndividualBulletin(@Param('enrollmentId') enrollmentId: string) {
    const data =
      await this.reportsService.getIndividualBulletinData(enrollmentId);
    return {
      success: true,
      message: 'Datos listos para renderizar',
      data,
    };
  }

  // Dispara el Worker de BullMQ
  @Post('bulletins/massive')
  // @UseGuards(JwtAuthGuard, PermissionsGuard)
  // @Permissions('manage:all:Reports') // 🔒 Solo administradores/directores
  async triggerMassiveBulletins(
    @Body() payload: { academicYearId: string; classroomId?: string },
    @Req() req: any, // Necesitamos el ID del usuario para avisarle luego
  ) {
    return this.reportsService.queueMassiveBulletins({
      ...payload,
      userId: req.user.id, // Extraemos el ID del JWT
    });
  }
}

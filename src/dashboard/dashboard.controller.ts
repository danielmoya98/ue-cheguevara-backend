import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant'; // 🔥 Importamos tu diccionario oficial

@ApiTags('Dashboard y Métricas')
@ApiCookieAuth('uecg_access_token')
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('root')
  @RequirePermissions(
    SystemPermissions.MANAGE_ALL_USER,
    SystemPermissions.MANAGE_ALL_ROLE,
  )
  @ApiOperation({
    summary: 'Obtiene métricas de infraestructura (Super Admin)',
  })
  async getRootStats() {
    return this.dashboardService.getRootStats();
  }

  @Get('global')
  @RequirePermissions(
    SystemPermissions.READ_ALL_STUDENT,
    SystemPermissions.MANAGE_ALL_INSTITUTION,
    SystemPermissions.READ_ALL_GRADE,
  )
  @ApiOperation({
    summary: 'Obtiene métricas generales del colegio (Director)',
  })
  async getGlobalStats() {
    return this.dashboardService.getGlobalStats();
  }

  @Get('teacher')
  @RequirePermissions(
    SystemPermissions.READ_OWN_STUDENT,
    SystemPermissions.CREATE_OWN_ATTENDANCE,
  )
  @ApiOperation({ summary: 'Obtiene métricas operativas del docente' })
  async getTeacherStats(@Req() req: any) {
    // req.user viene del token JWT
    return this.dashboardService.getTeacherStats(req.user.userId);
  }
}

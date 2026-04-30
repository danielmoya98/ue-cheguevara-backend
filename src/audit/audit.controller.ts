import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Auditoría del Sistema')
@ApiCookieAuth('uecg_access_token')
// 🔥 ESCUDO ACTIVADO: Ahora es imposible saltarse la seguridad
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  // 🔥 Usamos el permiso específico del catálogo ABAC en lugar del genérico
  @RequirePermissions(SystemPermissions.READ_ALL_AUDIT)
  @ApiOperation({ summary: 'Obtiene el historial de acciones del sistema' })
  async getLogs(@Query('limit') limit: string = '50') {
    // Delegamos la lógica al servicio
    return this.auditService.getLogs(limit);
  }
}

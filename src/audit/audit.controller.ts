import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto'; // 🔥 Importamos el DTO base

@ApiTags('Auditoría del Sistema')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(SystemPermissions.READ_ALL_AUDIT)
  @ApiOperation({ summary: 'Obtiene el historial de acciones del sistema' })
  async getLogs(@Query() query: PaginationDto) {
    // 🔥 Recibe el DTO completo
    return this.auditService.getLogs(query);
  }
}

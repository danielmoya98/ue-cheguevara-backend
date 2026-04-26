import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

// 🔥 NUEVAS IMPORTACIONES RBAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Tutores (App Móvil)')
@Controller('guardians')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Get('me')
  @ApiBearerAuth()
  @RequirePermissions(SystemPermissions.GUARDIAN_PROFILE_READ) // 🔥 Exclusivo para padres
  @ApiOperation({
    summary:
      'Devuelve el perfil del padre y sus hijos para el Dashboard de Flutter',
  })
  getMyProfile(@Req() req: any) {
    // req.user.userId viene de la validación del JWT
    return this.guardiansService.getMyProfileAndStudents(req.user.userId);
  }
}

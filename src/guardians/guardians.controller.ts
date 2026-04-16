import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport'; // Usa tu JwtAuthGuard si lo tienes personalizado
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../prisma/generated/client';

@ApiTags('Tutores (App Móvil)')
@Controller('guardians')
@UseGuards(AuthGuard('jwt'), RolesGuard) // Protegemos todo el controlador
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Get('me')
  @ApiBearerAuth()
  @Roles(Role.PADRE) // Solo los padres pueden ver esta ruta
  @ApiOperation({
    summary:
      'Devuelve el perfil del padre y sus hijos para el Dashboard de Flutter',
  })
  getMyProfile(@Req() req: any) {
    // req.user.sub viene de tu AuthModule (payload del JWT)
    return this.guardiansService.getMyProfileAndStudents(req.user.userId);
  }
}

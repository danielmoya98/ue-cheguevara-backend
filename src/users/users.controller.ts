import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { CacheTTL } from '@nestjs/cache-manager';
import { UserProfileCacheInterceptor } from '../common/interceptors/user-profile-cache.interceptor';

// 🔥 IMPORTACIONES RBAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Usuarios')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // =======================================================
  // ENDPOINTS DE PERFIL CACHEADOS (Acceso Libre)
  // =======================================================

  @Get('profile')
  @UseInterceptors(UserProfileCacheInterceptor)
  @CacheTTL(60000)
  @ApiOperation({
    summary: 'Obtiene los datos del perfil del usuario logueado',
  })
  getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza los datos básicos de mi perfil' })
  updateProfile(@Req() req: any, @Body() updateProfileDto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, updateProfileDto);
  }

  @Post('profile/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambia la contraseña de manera voluntaria' })
  changePassword(
    @Req() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.userId, changePasswordDto);
  }

  // =======================================================
  // ENDPOINTS ADMINISTRATIVOS (Protegidos con RBAC)
  // =======================================================

  @Post()
  @RequirePermissions(SystemPermissions.USERS_WRITE) // 🔥 Solo Admin
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @RequirePermissions(SystemPermissions.USERS_READ) // 🔥 Solo Admin
  @ApiOperation({ summary: 'Obtener lista de todos los usuarios paginada' })
  findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  @Patch(':id')
  @RequirePermissions(SystemPermissions.USERS_WRITE) // 🔥 Solo Admin
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar nombre o rol de un usuario' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequirePermissions(SystemPermissions.USERS_WRITE) // 🔥 Solo Admin
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar un usuario por su ID (Soft Delete)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Patch(':id/reactivate')
  @RequirePermissions(SystemPermissions.USERS_WRITE) // 🔥 Solo Admin
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivar a un usuario inactivo' })
  reactivate(@Param('id') id: string) {
    return this.usersService.reactivate(id);
  }

  @Post(':id/reset-password')
  @RequirePermissions(SystemPermissions.USERS_WRITE) // 🔥 Solo Admin
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Genera una nueva contraseña temporal' })
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id);
  }
}

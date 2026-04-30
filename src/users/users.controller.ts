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

// 🔥 IMPORTACIONES SEGURIDAD ABAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Usuarios')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // =======================================================
  // ENDPOINTS DE PERFIL PERSONAL
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
  // ENDPOINTS ADMINISTRATIVOS (Jerarquía ABAC activada)
  // =======================================================

  @Post()
  @RequirePermissions(SystemPermissions.MANAGE_ALL_USER) // 🔥 ABAC
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  create(@Body() createUserDto: CreateUserDto, @Req() req: any) {
    return this.usersService.create(createUserDto, req.user);
  }

  @Get()
  @RequirePermissions(SystemPermissions.MANAGE_ALL_USER) // 🔥 ABAC
  @ApiOperation({ summary: 'Obtener lista de usuarios filtrada por jerarquía' })
  findAll(@Query() query: PaginationDto, @Req() req: any) {
    return this.usersService.findAll(query, req.user);
  }

  @Patch(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_USER) // 🔥 ABAC
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar nombre o rol de un usuario' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    return this.usersService.update(id, updateUserDto, req.user);
  }

  @Delete(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_USER) // 🔥 ABAC
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar un usuario (Soft Delete)' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.usersService.remove(id, req.user);
  }

  @Patch(':id/reactivate')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_USER) // 🔥 ABAC
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivar a un usuario inactivo' })
  reactivate(@Param('id') id: string, @Req() req: any) {
    return this.usersService.reactivate(id, req.user);
  }

  @Post(':id/reset-password')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_USER) // 🔥 ABAC
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Genera una nueva contraseña temporal' })
  resetPassword(@Param('id') id: string, @Req() req: any) {
    return this.usersService.resetPassword(id, req.user);
  }
}

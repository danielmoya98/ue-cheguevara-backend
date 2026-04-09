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
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../prisma/generated/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { CacheTTL } from '@nestjs/cache-manager'; // <-- 1. Importamos TTL
import { UserProfileCacheInterceptor } from '../common/interceptors/user-profile-cache.interceptor'; // <-- 2. Interceptor personalizado

@ApiTags('Usuarios')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // =======================================================
  // ENDPOINTS DE PERFIL CACHEADOS
  // =======================================================

  @Get('profile')
  @UseInterceptors(UserProfileCacheInterceptor) // <-- Caché segura por Usuario
  @CacheTTL(60000) // <-- 1 minuto de vida en RAM (60,000 ms)
  @ApiOperation({
    summary: 'Obtiene los datos del perfil del usuario logueado',
  })
  getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualiza los datos básicos de mi perfil (C.I., celular, etc.)',
  })
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
  // ENDPOINTS ADMINISTRATIVOS (IDEMPOTENCIA ACTIVADA)
  // =======================================================

  @Post()
  @Roles(Role.ADMIN)
  @UseInterceptors(IdempotencyInterceptor) // <-- Protege contra clics dobles
  @ApiOperation({ summary: 'Crear un nuevo usuario (Soporta Idempotencia)' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener lista de todos los usuarios paginada' })
  findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar nombre o rol de un usuario (Requiere rol ADMIN)',
  })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar un usuario por su ID (Soft Delete)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Patch(':id/reactivate')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivar a un usuario inactivo (Requiere ADMIN)' })
  reactivate(@Param('id') id: string) {
    return this.usersService.reactivate(id);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @UseInterceptors(IdempotencyInterceptor) // <-- Protege contra clics dobles
  @ApiOperation({
    summary: 'Genera una nueva contraseña temporal (Soporta Idempotencia)',
  })
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id);
  }
}

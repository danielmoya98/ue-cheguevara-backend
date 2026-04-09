import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { SetupPasswordDto } from './dto/setup-password.dto';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard) // Escudo anti-fuerza bruta activo
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Regla: 5 intentos por minuto
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión y devuelve una Cookie segura' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, ...result } = await this.authService.login(
      loginDto.email,
      loginDto.password,
    );

    if (result.status === 'SUCCESS' && access_token) {
      res.cookie('uecg_access_token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
      });
    }

    return result;
  }

  @Post('setup-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Configura la clave definitiva y devuelve una Cookie segura',
  })
  async setupPassword(
    @Body() setupDto: SetupPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 🔥 AQUÍ ESTÁ EL CAMBIO: Pasamos setupToken en lugar de userId 🔥
    const { access_token, ...result } = await this.authService.setupNewPassword(
      setupDto.setupToken,
      setupDto.newPassword,
    );

    if (result.status === 'SUCCESS' && access_token) {
      res.cookie('uecg_access_token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
      });
    }

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierra sesión destruyendo la Cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('uecg_access_token');
    return { status: 'SUCCESS', message: 'Sesión cerrada exitosamente' };
  }
}

import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { SetupPasswordDto } from './dto/setup-password.dto';
import { RegisterGuardianDto } from './dto/register-guardian.dto';
import { RegisterStudentDto } from './dto/register-student.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión (Soporta Web y App Móvil)' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      loginDto.email,
      loginDto.password,
    );

    if (result.status === 'SUCCESS' && result.access_token) {
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('uecg_access_token', result.access_token, {
        httpOnly: true,
        secure: isProduction, // true en Render (HTTPS)
        sameSite: isProduction ? 'none' : 'lax', // 'none' permite Cross-Site
        maxAge: 8 * 60 * 60 * 1000,
      });
    }

    return result;
  }

  @Post('setup-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Configura la clave definitiva' })
  async setupPassword(
    @Body() setupDto: SetupPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.setupNewPassword(
      setupDto.setupToken,
      setupDto.newPassword,
    );

    if (result.status === 'SUCCESS' && result.access_token) {
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('uecg_access_token', result.access_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 8 * 60 * 60 * 1000,
      });
    }

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierra sesión destruyendo la Cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.clearCookie('uecg_access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });

    return { status: 'SUCCESS', message: 'Sesión cerrada exitosamente' };
  }

  @Post('register-guardian')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Auto-registro para padres desde la App Móvil' })
  async registerGuardian(@Body() registerDto: RegisterGuardianDto) {
    return this.authService.registerGuardian(registerDto);
  }

  @Post('register-student')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Auto-registro para alumnos desde la App Móvil' })
  async registerStudent(@Body() registerDto: RegisterStudentDto) {
    return this.authService.registerStudent(registerDto);
  }

  // =========================================================
  // 🔥 NUEVOS: ENDPOINTS DE RECUPERACIÓN DE CONTRASEÑA
  // =========================================================
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Envía un código OTP de 6 dígitos al correo de respaldo del usuario',
  })
  async forgotPassword(@Body('identifier') identifier: string) {
    return this.authService.requestPasswordReset(identifier);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifica el código OTP y cambia la contraseña' })
  async resetPassword(
    @Body('identifier') identifier: string,
    @Body('code') code: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPasswordWithCode(
      identifier,
      code,
      newPassword,
    );
  }

  // =========================================================
  // 🔥 CORREGIDO: ENDPOINT PARA REGISTRAR DISPOSITIVO
  // =========================================================
  @Patch('fcm-token')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registra el token del celular (Firebase) para recibir Push',
  })
  async registerFcmToken(@Req() req: any, @Body('fcmToken') fcmToken: string) {
    // 🔥 AQUÍ ESTABA EL ERROR: Tu estrategia exporta 'userId', no 'sub' ni 'id'
    const userId = req.user?.userId;

    if (!userId) {
      // Un escudo extra por si acaso
      throw new UnauthorizedException(
        'No se pudo identificar al usuario en el token',
      );
    }

    return this.authService.registerFcmToken(userId, fcmToken);
  }
}

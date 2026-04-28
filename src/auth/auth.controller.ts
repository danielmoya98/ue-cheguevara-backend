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
import type { Response, Request } from 'express';
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

  // ==========================================
  // HELPER PARA INYECCIÓN DE COOKIES
  // ==========================================
  private setTokenCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProduction = process.env.NODE_ENV === 'production';

    // 🔥 FIX TYPE SCRIPT: Forzamos el tipado estricto para Express CookieOptions
    const sameSitePolicy = (isProduction ? 'none' : 'lax') as 'none' | 'lax';

    // Cookie de Acceso (15 Minutos)
    res.cookie('uecg_access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: sameSitePolicy,
      maxAge: 15 * 60 * 1000,
    });

    // Cookie de Refresco (7 Días)
    res.cookie('uecg_refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: sameSitePolicy,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  // ==========================================
  // FLUJOS DE SESIÓN
  // ==========================================

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

    if (
      result.status === 'SUCCESS' &&
      result.access_token &&
      result.refresh_token
    ) {
      this.setTokenCookies(res, result.access_token, result.refresh_token);
    }

    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rota el Refresh Token para extender la sesión silenciosamente',
  })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. Extraemos el Refresh Token de la cookie
    const refreshToken = req.cookies['uecg_refresh_token'];

    if (!refreshToken) {
      throw new UnauthorizedException(
        'No se proporcionó un Refresh Token válido.',
      );
    }

    // 2. Validamos con la base de datos y generamos nuevos tokens
    const result = await this.authService.refreshTokens(refreshToken);

    // 3. Inyectamos las nuevas cookies rotadas
    if (
      result.status === 'SUCCESS' &&
      result.access_token &&
      result.refresh_token
    ) {
      this.setTokenCookies(res, result.access_token, result.refresh_token);
    }

    return { status: 'SUCCESS', message: 'Sesión renovada exitosamente' };
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

    if (
      result.status === 'SUCCESS' &&
      result.access_token &&
      result.refresh_token
    ) {
      this.setTokenCookies(res, result.access_token, result.refresh_token);
    }

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierra sesión destruyendo todas las Cookies' })
  logout(@Res({ passthrough: true }) res: Response) {
    const isProduction = process.env.NODE_ENV === 'production';

    // 🔥 FIX TYPE SCRIPT
    const sameSitePolicy = (isProduction ? 'none' : 'lax') as 'none' | 'lax';

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: sameSitePolicy,
    };

    res.clearCookie('uecg_access_token', cookieOptions);
    res.clearCookie('uecg_refresh_token', cookieOptions);

    return { status: 'SUCCESS', message: 'Sesión cerrada exitosamente' };
  }

  // ==========================================
  // REGISTROS MÓVILES
  // ==========================================

  @Post('register-guardian')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Auto-registro para padres desde la App Móvil' })
  async registerGuardian(@Body() registerDto: RegisterGuardianDto) {
    return this.authService.registerGuardian(registerDto);
  }

  @Post('register-student')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Auto-registro para alumnos desde la App Móvil' })
  async registerStudent(
    @Body() registerDto: RegisterStudentDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerStudent(registerDto);

    if (
      result.status === 'SUCCESS' &&
      result.access_token &&
      result.refresh_token
    ) {
      this.setTokenCookies(res, result.access_token, result.refresh_token);
    }
    return result;
  }

  // ==========================================
  // RECUPERACIÓN DE CONTRASEÑA
  // ==========================================

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envía un código OTP al correo de respaldo' })
  async forgotPassword(@Body('identifier') identifier: string) {
    return this.authService.requestPasswordReset(identifier);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifica OTP y cambia la contraseña' })
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

  // ==========================================
  // CONFIGURACIONES ADICIONALES
  // ==========================================

  @Patch('fcm-token')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registra el token del celular para recibir Push' })
  async registerFcmToken(@Req() req: any, @Body('fcmToken') fcmToken: string) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        'No se pudo identificar al usuario en el token',
      );
    }
    return this.authService.registerFcmToken(userId, fcmToken);
  }
}

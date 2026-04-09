import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('Credenciales incorrectas');

    if (user.status === 'INACTIVE') {
      throw new ForbiddenException('Cuenta desactivada. Contacte a Dirección.');
    }

    // FLUJO DE SETUP PASSWORD (SEGURO CONTRA IDOR)
    if (user.requiresPasswordChange) {
      // Generamos un token temporal de uso exclusivo para configuración
      const setupToken = await this.jwtService.signAsync(
        { sub: user.id, type: 'setup_password' },
        { expiresIn: '15m' }, // Expira rápido por seguridad
      );

      return {
        status: 'SETUP_REQUIRED',
        message: 'Debe cambiar su contraseña temporal',
        setupToken: setupToken, // Devolvemos el JWT, no el UUID expuesto
      };
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      status: 'SUCCESS',
      access_token: await this.jwtService.signAsync(payload),
      user: { id: user.id, fullName: user.fullName, role: user.role },
    };
  }

  async setupNewPassword(setupToken: string, newPasswordRaw: string) {
    let userId: string;

    // Validamos que el token no haya sido alterado y no esté expirado
    try {
      const decoded = await this.jwtService.verifyAsync(setupToken);
      if (decoded.type !== 'setup_password') {
        throw new UnauthorizedException(
          'El token no corresponde a esta operación',
        );
      }
      userId = decoded.sub;
    } catch (error) {
      throw new UnauthorizedException(
        'Token de configuración inválido o expirado',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPasswordRaw, salt);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        requiresPasswordChange: false,
      },
    });

    const payload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    };

    return {
      status: 'SUCCESS',
      message: 'Contraseña actualizada correctamente',
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}

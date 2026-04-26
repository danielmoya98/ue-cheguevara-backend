import { Strategy, ExtractJwt } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          let token = null;
          if (req && req.cookies) {
            token = req.cookies['uecg_access_token'];
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super_secreto_uecg_2026',
    });
  }

  // 🔥 ACTUALIZADO: El payload ahora recibe roleName y permissions
  async validate(payload: {
    sub: string;
    email: string;
    roleName: string;
    permissions: string[];
  }) {
    // Fíjate que aquí YA NO HACEMOS INCLUDE DEL ROL. El Token ya tiene los permisos en texto.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status === 'INACTIVE') {
      throw new UnauthorizedException('Acceso denegado o cuenta inactiva');
    }

    // Retornamos el objeto 'req.user' que usarán todos tus controladores
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.roleName,
      permissions: payload.permissions || [],
    };
  }
}

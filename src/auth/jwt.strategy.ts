import { Strategy, ExtractJwt } from 'passport-jwt'; // <-- Asegúrate de importar ExtractJwt
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      // 🔥 EL ARREGLO BILINGÜE: Soporta Flutter y Web simultáneamente
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Prioridad 1: Busca en las cabeceras (Para la App Móvil Flutter)
        ExtractJwt.fromAuthHeaderAsBearerToken(),

        // 2. Prioridad 2: Si no hay cabecera, busca en las cookies (Para Web/Next.js)
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

  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status === 'INACTIVE') {
      throw new UnauthorizedException('Acceso denegado o cuenta inactiva');
    }

    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}

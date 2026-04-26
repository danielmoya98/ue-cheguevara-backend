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
        (req: Request) => req?.cookies?.['uecg_access_token'] || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super_secreto_uecg_2026',
    });
  }

  async validate(payload: any) {
    // No hacemos include de roles aquí para optimizar cada request (ABAC/RBAC listo)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true, email: true },
    });

    if (!user || user.status === 'INACTIVE') {
      throw new UnauthorizedException('Acceso denegado');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.roleName,
      permissions: payload.permissions || [],
    };
  }
}

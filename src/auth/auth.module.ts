import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesController } from './controllers/roles.controller';
import { RolesService } from './services/roles.service';
import { PermissionsSyncService } from './services/permissions-sync.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secreto_uecg_2026', // En producción, usa un .env fuerte
      signOptions: { expiresIn: '8h' }, // La sesión dura un turno laboral (8 horas)
    }),
  ],
  controllers: [AuthController, RolesController],
  providers: [
    AuthService,
    PrismaService,
    JwtStrategy,
    RolesService,
    PermissionsSyncService,
  ],
})
export class AuthModule {}

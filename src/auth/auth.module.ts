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
import { EncryptionService } from '../common/services/encryption.service'; // Ajusta la ruta

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secreto_uecg_2026',
    }),
  ],
  controllers: [AuthController, RolesController],
  providers: [
    AuthService,
    PrismaService,
    JwtStrategy,
    RolesService,
    PermissionsSyncService,
    EncryptionService,
  ],
})
export class AuthModule {}

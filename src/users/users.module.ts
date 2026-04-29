import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service'; // 🔥 1. IMPORTAR AQUÍ

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    PrismaService,
    EncryptionService, // 🔥 2. DECLARARLO AQUÍ
  ],
  exports: [UsersService], // (Si ya lo tenías, déjalo)
})
export class UsersModule {}

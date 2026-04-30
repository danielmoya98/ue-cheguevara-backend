import { Module } from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { GuardiansController } from './guardians.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionService } from '../common/services/encryption.service'; // 🔥 IMPORTADO

@Module({
  imports: [PrismaModule],
  controllers: [GuardiansController],
  providers: [
    GuardiansService,
    EncryptionService, // 🔥 REGISTRADO COMO PROVEEDOR PARA LA INYECCIÓN DE DEPENDENCIAS
  ],
  exports: [GuardiansService],
})
export class GuardiansModule {}

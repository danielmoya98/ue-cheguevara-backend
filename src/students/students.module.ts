import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { EncryptionService } from '../common/services/encryption.service'; // 🔥 IMPORTADO

@Module({
  controllers: [StudentsController],
  providers: [
    StudentsService,
    EncryptionService, // 🔥 INYECTADO
  ],
})
export class StudentsModule {}

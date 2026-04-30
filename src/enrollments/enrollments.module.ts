import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';
import { EncryptionService } from '../common/services/encryption.service'; // 🔥 IMPORTADO

@Module({
  controllers: [EnrollmentsController],
  providers: [
    EnrollmentsService,
    EncryptionService, // 🔥 INYECTADO
  ],
})
export class EnrollmentsModule {}

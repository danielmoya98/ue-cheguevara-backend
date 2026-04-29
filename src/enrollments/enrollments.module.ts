import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';
import { EncryptionService } from '../common/services/encryption.service'; // 🔥 IMPORTADO
import { EnrollmentsPolicy } from './enrollments.policy'; // 🔥 POLÍTICA ABAC IMPORTADA

@Module({
  controllers: [EnrollmentsController],
  providers: [
    EnrollmentsService,
    EncryptionService, // 🔥 INYECTADO
    EnrollmentsPolicy, // 🔥 INYECTADO
  ],
})
export class EnrollmentsModule {}

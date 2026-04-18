import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityProcessor } from './identity.processor';
import { IdentityGateway } from './identity.gateway';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: 'export-queue' }), // Reutiliza tu cola
  ],
  controllers: [IdentityController],
  providers: [IdentityService, IdentityProcessor, IdentityGateway],
  exports: [IdentityService],
})
export class IdentityModule {}
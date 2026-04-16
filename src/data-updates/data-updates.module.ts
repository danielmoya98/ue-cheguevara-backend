import { Module } from '@nestjs/common';
import { DataUpdatesService } from './data-updates.service';
import { DataUpdatesController } from './data-updates.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [
    PrismaModule,
    FirebaseModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'mi_secreto_super_seguro',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [DataUpdatesController],
  providers: [DataUpdatesService],
})
export class DataUpdatesModule {}

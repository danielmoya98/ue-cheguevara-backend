import { Module } from '@nestjs/common';
import { TrimestersController } from './trimesters.controller';
import { TrimestersService } from './trimesters.service';

@Module({
  controllers: [TrimestersController],
  providers: [TrimestersService]
})
export class TrimestersModule {}

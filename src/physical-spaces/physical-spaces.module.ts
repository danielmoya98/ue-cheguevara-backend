import { Module } from '@nestjs/common';
import { PhysicalSpacesService } from './physical-spaces.service';
import { PhysicalSpacesController } from './physical-spaces.controller';

@Module({
  controllers: [PhysicalSpacesController],
  providers: [PhysicalSpacesService],
})
export class PhysicalSpacesModule {}

import { PartialType } from '@nestjs/swagger';
import { CreatePhysicalSpaceDto } from './create-physical-space.dto';

export class UpdatePhysicalSpaceDto extends PartialType(
  CreatePhysicalSpaceDto,
) {}

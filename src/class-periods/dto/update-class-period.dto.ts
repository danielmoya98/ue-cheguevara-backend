import { PartialType } from '@nestjs/swagger';
import { CreateClassPeriodDto } from './create-class-period.dto';

export class UpdateClassPeriodDto extends PartialType(CreateClassPeriodDto) {}
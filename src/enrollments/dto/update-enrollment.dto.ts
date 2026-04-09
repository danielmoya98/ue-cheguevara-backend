import { PartialType } from '@nestjs/swagger';
import { CreateEnrollmentDto } from './create-enrollment.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EnrollmentStatus } from '../../../prisma/generated/client';

export class UpdateEnrollmentDto extends PartialType(CreateEnrollmentDto) {
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  // El director puede enviarnos el RUDE generado por el Ministerio
  @IsOptional()
  @IsString()
  rudeCode?: string;
}

import { PartialType } from '@nestjs/swagger';
import { CreateEnrollmentDto } from './create-enrollment.dto';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { EnrollmentStatus } from '../../../prisma/generated/client';

export class UpdateEnrollmentDto extends PartialType(CreateEnrollmentDto) {
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  // El director puede enviarnos el RUDE generado por el Ministerio
  @IsOptional()
  @IsString()
  rudeCode?: string;

  // 🔥 NUEVO: Validamos que recibimos el checklist de documentos como un objeto
  @IsOptional()
  @IsObject()
  receivedDocuments?: Record<string, boolean>;
}

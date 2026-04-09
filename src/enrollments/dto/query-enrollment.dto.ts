import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto'; // Aquí ya viene "search"
import {
  EnrollmentType,
  EducationLevel,
} from '../../../prisma/generated/client';

export class QueryEnrollmentDto extends PaginationDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  classroomId?: string;

  // 🔥 CAMBIO: Ahora es un string para poder recibir arreglos separados por comas
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(EnrollmentType)
  enrollmentType?: EnrollmentType;

  @IsOptional()
  @IsEnum(EducationLevel)
  level?: EducationLevel;
}

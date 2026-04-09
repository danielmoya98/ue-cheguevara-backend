import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsNotEmpty,
  IsEnum,
  Min,
  IsDate,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AcademicStatus } from '../../../prisma/generated/client';

export class CreateAcademicYearDto {
  @ApiProperty({ example: 2026, description: 'Año de la gestión' })
  @IsInt()
  @Min(2020, { message: 'El año no puede ser menor a 2020' })
  @IsNotEmpty()
  year: number;

  @ApiProperty({
    example: 'Gestión Académica 2026',
    description: 'Nombre oficial',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '2026-02-01T00:00:00.000Z',
    description: 'Inicio de clases',
  })
  @Type(() => Date)
  @IsDate({ message: 'Debe ser una fecha válida' })
  @IsNotEmpty()
  startDate: Date;

  @ApiProperty({
    example: '2026-11-30T00:00:00.000Z',
    description: 'Fin de clases',
  })
  @Type(() => Date)
  @IsDate({ message: 'Debe ser una fecha válida' })
  @IsNotEmpty()
  endDate: Date;

  @ApiProperty({
    enum: AcademicStatus,
    default: AcademicStatus.PLANNING,
    required: false,
  })
  @IsOptional()
  @IsEnum(AcademicStatus, { message: 'Estado inválido' })
  status?: AcademicStatus;
}

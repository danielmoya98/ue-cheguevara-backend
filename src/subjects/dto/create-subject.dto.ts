import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { EducationLevel } from '../../../prisma/generated/client';

export class CreateSubjectDto {
  @ApiProperty({
    example: 'Matemáticas',
    description: 'Nombre oficial de la materia',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la materia es obligatorio' })
  name: string;

  @ApiProperty({
    enum: EducationLevel,
    description: 'Nivel en el que se dicta',
  })
  @IsEnum(EducationLevel, { message: 'Nivel educativo inválido' })
  level: EducationLevel;

  @ApiProperty({ example: 'Ciencias Exactas', required: false })
  @IsString()
  @IsOptional()
  area?: string;
}

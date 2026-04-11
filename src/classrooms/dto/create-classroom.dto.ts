import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { EducationLevel, Shift } from '../../../prisma/generated/client';

export class CreateClassroomDto {
  @ApiProperty({ example: 'uuid-del-año-2026' })
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  @ApiProperty({ enum: EducationLevel })
  @IsEnum(EducationLevel, { message: 'Nivel educativo inválido' })
  level: EducationLevel;

  @ApiProperty({ enum: Shift })
  @IsEnum(Shift, { message: 'Turno inválido' })
  shift: Shift;

  @ApiProperty({ example: 'Primero', description: 'Grado escolar' })
  @IsString()
  @IsNotEmpty()
  grade: string;

  @ApiProperty({ example: 'A', description: 'Paralelo' })
  @IsString()
  @IsNotEmpty()
  section: string;

  @ApiProperty({ example: 35, description: 'Capacidad máxima de alumnos' })
  @IsInt()
  @Min(10)
  @Max(50)
  @IsOptional()
  capacity?: number;

  @ApiProperty({ example: 'uuid-del-docente', required: false })
  @IsUUID()
  @IsOptional()
  advisorId?: string;

  // 🔥 NUEVO: Espacio Físico Base
  @ApiProperty({ example: 'uuid-del-aula', required: false })
  @IsUUID()
  @IsOptional()
  baseRoomId?: string;
}

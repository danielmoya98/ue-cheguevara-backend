import { IsUUID, IsInt, Min, Max, IsOptional, IsEnum } from 'class-validator';
import { GradeStatus } from '../../../prisma/generated/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertGradeDto {
  @ApiProperty({ description: 'ID de la inscripción del estudiante' })
  @IsUUID()
  enrollmentId: string;

  @ApiProperty({
    description: 'ID de la asignación del docente (Materia/Curso)',
  })
  @IsUUID()
  teacherAssignmentId: string;

  @ApiProperty({ description: 'ID del trimestre a calificar' })
  @IsUUID()
  trimesterId: string;

  @ApiPropertyOptional({
    description: 'Nota del SER (0-10)',
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsInt({ message: 'La nota del SER debe ser un número entero' })
  @Min(0)
  @Max(10, { message: 'El SER no puede exceder los 10 puntos' })
  scoreSer?: number;

  @ApiPropertyOptional({
    description: 'Nota del SABER (0-45)',
    minimum: 0,
    maximum: 45,
  })
  @IsOptional()
  @IsInt({ message: 'La nota del SABER debe ser un número entero' })
  @Min(0)
  @Max(45, { message: 'El SABER no puede exceder los 45 puntos' })
  scoreSaber?: number;

  @ApiPropertyOptional({
    description: 'Nota del HACER (0-40)',
    minimum: 0,
    maximum: 40,
  })
  @IsOptional()
  @IsInt({ message: 'La nota del HACER debe ser un número entero' })
  @Min(0)
  @Max(40, { message: 'El HACER no puede exceder los 40 puntos' })
  scoreHacer?: number;

  @ApiPropertyOptional({
    description: 'Nota de AUTOEVALUACIÓN (0-5)',
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @IsInt({ message: 'La AUTOEVALUACIÓN debe ser un número entero' })
  @Min(0)
  @Max(5, { message: 'La AUTOEVALUACIÓN no puede exceder los 5 puntos' })
  scoreAuto?: number;

  @ApiPropertyOptional({ enum: GradeStatus })
  @IsOptional()
  @IsEnum(GradeStatus)
  status?: GradeStatus;
}

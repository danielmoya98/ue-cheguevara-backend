import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class GetMonitorDto {
  @ApiProperty({ description: 'ID del curso (Ej. 5to A Secundaria)' })
  @IsUUID()
  @IsNotEmpty()
  classroomId: string;

  @ApiProperty({ description: 'ID del periodo de clase (Ej. 1ra Hora)' })
  @IsUUID()
  @IsNotEmpty()
  classPeriodId: string;

  @ApiPropertyOptional({ description: 'Fecha a consultar (YYYY-MM-DD). Por defecto: hoy' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
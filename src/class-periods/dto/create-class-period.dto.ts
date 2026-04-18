import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsBoolean, IsInt, Matches, IsNotEmpty, Min } from 'class-validator';
import { Shift } from '../../../prisma/generated/client';

export class CreateClassPeriodDto {
  @ApiProperty({ description: 'Nombre del periodo (Ej: 1ra Hora, Recreo)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Hora de inicio formato HH:MM (Ej: 08:00)' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime debe tener el formato HH:MM' })
  startTime: string;

  @ApiProperty({ description: 'Hora de fin formato HH:MM (Ej: 08:40)' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime debe tener el formato HH:MM' })
  endTime: string;

  @ApiProperty({ enum: Shift, description: 'Turno al que pertenece este periodo' })
  @IsEnum(Shift)
  @IsNotEmpty()
  shift: Shift;

  @ApiProperty({ description: '¿Es un periodo de descanso/recreo?' })
  @IsBoolean()
  isBreak: boolean;

  @ApiProperty({ description: 'Orden cronológico para mostrar en la tabla (Ej: 1, 2, 3...)' })
  @IsInt()
  @Min(1)
  order: number;
}
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Min, IsEnum, IsOptional } from 'class-validator';
import { NotificationFrequency } from '../../../prisma/generated/client';

export class UpdateAttendanceSettingsDto {
  @ApiProperty({ description: 'Habilitar toma de asistencia con App Móvil QR' })
  @IsOptional()
  @IsBoolean()
  enableQrAttendance?: boolean;

  @ApiProperty({ description: 'Habilitar toma de asistencia con Reloj Biométrico' })
  @IsOptional()
  @IsBoolean()
  enableBiometricAttendance?: boolean;

  @ApiProperty({ description: 'Minutos de tolerancia para Atraso' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lateToleranceMinutes?: number;

  @ApiProperty({ description: 'Minutos de tolerancia para Falta Injustificada' })
  @IsOptional()
  @IsInt()
  @Min(0)
  absentToleranceMinutes?: number;

  @ApiProperty({ enum: NotificationFrequency, description: 'Frecuencia de alertas a padres' })
  @IsOptional()
  @IsEnum(NotificationFrequency)
  notificationFrequency?: NotificationFrequency;
}
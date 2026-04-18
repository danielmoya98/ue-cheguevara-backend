import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Min, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer'; // 🔥 IMPORTA ESTO

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
  @Type(() => Number) // 🔥 BLINDAJE: Si llega como string "5", lo convierte a número 5
  @IsInt()
  @Min(0)
  lateToleranceMinutes?: number;

  @ApiProperty({ description: 'Minutos de tolerancia para Falta Injustificada' })
  @IsOptional()
  @Type(() => Number) // 🔥 BLINDAJE
  @IsInt()
  @Min(0)
  absentToleranceMinutes?: number;

  @ApiProperty({ description: 'Frecuencia de alertas a padres' })
  @IsOptional()
  @IsString()
  notificationFrequency?: string;
}
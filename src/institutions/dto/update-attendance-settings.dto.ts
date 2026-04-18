import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Min, IsString, IsOptional } from 'class-validator';

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
  @IsInt({ message: 'La tolerancia de atraso debe ser un número entero' })
  @Min(0, { message: 'No puede ser menor a 0' })
  lateToleranceMinutes?: number;

  @ApiProperty({ description: 'Minutos de tolerancia para Falta Injustificada' })
  @IsOptional()
  @IsInt({ message: 'La tolerancia de falta debe ser un número entero' })
  @Min(0, { message: 'No puede ser menor a 0' })
  absentToleranceMinutes?: number;

  // 🔥 CORRECCIÓN CLAVE: Usamos IsString en lugar de IsEnum para evitar 
  // el choque de tipos con el diccionario compilado de Prisma.
  @ApiProperty({ description: 'Frecuencia de alertas a padres' })
  @IsOptional()
  @IsString({ message: 'La frecuencia de notificación debe ser una cadena de texto' })
  notificationFrequency?: string;
}
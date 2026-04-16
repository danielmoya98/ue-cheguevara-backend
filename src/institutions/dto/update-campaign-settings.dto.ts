import {
  IsBoolean,
  IsNumber,
  IsArray,
  Min,
  Max,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCampaignSettingsDto {
  @ApiProperty({ description: 'Activa o desactiva la recepción de datos web' })
  @IsOptional()
  @IsBoolean()
  enableDigitalRudeUpdates?: boolean;

  @ApiProperty({
    description: 'Límite de solicitudes por estudiante',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  maxRudeUpdatesPerYear?: number;

  @ApiProperty({ description: 'Canales activos para notificar' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true }) // 🔥 Cambio clave: Aceptamos strings normales para evitar conflictos con Prisma
  activeNotificationChannels?: string[];
}

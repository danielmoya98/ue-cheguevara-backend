import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength } from 'class-validator';
// 🔥 ELIMINADO: import { Role } from '../../../prisma/generated/client';
// 🔥 ELIMINADO: IsEnum de class-validator

export class UpdateUserDto {
  @ApiProperty({ example: 'Carlos Mendoza', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  fullName?: string;

  // 🔥 ACTUALIZADO: Ahora espera un String plano en lugar del Enum
  @ApiProperty({
    example: 'SECRETARIA',
    description: 'Nombre exacto del nuevo rol (ej. ADMIN, DOCENTE, SECRETARIA)',
    required: false,
  })
  @IsOptional()
  @IsString()
  role?: string;
}

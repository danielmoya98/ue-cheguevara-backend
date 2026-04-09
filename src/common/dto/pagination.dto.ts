import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Término de búsqueda general por nombre o email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Campo para ordenar. Ej: -createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  // 🔥 CORRECCIÓN: Añadimos role al DTO para que NestJS lo acepte
  @ApiPropertyOptional({
    description: 'Filtro por rol específico del usuario',
  })
  @IsOptional()
  @IsString()
  role?: string;
}

import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { SpaceType } from '../../../prisma/generated/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePhysicalSpaceDto {
  @ApiProperty({
    description: 'Nombre del espacio físico',
    example: 'Aula 101',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del espacio es obligatorio' })
  name: string;

  @ApiProperty({ description: 'Tipo de espacio', enum: SpaceType })
  @IsEnum(SpaceType, { message: 'El tipo de espacio no es válido' })
  @IsNotEmpty()
  type: SpaceType;

  // 🗑️ ELIMINAMOS EL CAMPO CAPACITY DE AQUÍ

  @ApiProperty({ description: 'Si el espacio está habilitado para su uso' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

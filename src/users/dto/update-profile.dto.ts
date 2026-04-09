import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Carlos Mendoza', required: false })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  fullName?: string;

  @ApiProperty({ example: '1234567', required: false })
  @IsOptional()
  @IsString()
  ci?: string;

  @ApiProperty({ example: '70012345', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Calle Falsa 123', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Matemáticas', required: false })
  @IsOptional()
  @IsString()
  specialty?: string;
}

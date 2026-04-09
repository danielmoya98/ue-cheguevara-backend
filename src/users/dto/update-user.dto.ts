import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, IsEnum } from 'class-validator';
import { Role } from '../../../prisma/generated/client';

export class UpdateUserDto {
  @ApiProperty({ example: 'Carlos Mendoza', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  fullName?: string;

  @ApiProperty({ enum: Role, required: false })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

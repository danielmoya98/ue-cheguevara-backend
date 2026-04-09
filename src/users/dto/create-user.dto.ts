import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsEnum,
  MinLength,
} from 'class-validator';
import { Role } from '../../../prisma/generated/client';

export class CreateUserDto {
  @ApiProperty({
    example: 'Carlos Mendoza',
    description: 'Nombre completo del usuario',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  fullName: string;

  @ApiProperty({
    example: 'c.mendoza@uecg.edu.bo',
    description: 'Correo institucional (autogenerado)',
  })
  @IsEmail({}, { message: 'Debe ser un correo válido' })
  email: string;

  @ApiProperty({
    example: 'x8kf9m2',
    description: 'Contraseña temporal sin encriptar',
  })
  @IsString()
  @MinLength(6, {
    message: 'La contraseña temporal debe tener al menos 6 caracteres',
  })
  passwordRaw: string;

  @ApiProperty({
    enum: Role,
    example: Role.DOCENTE,
    description: 'Rol de acceso al sistema',
  })
  @IsEnum(Role, { message: 'El rol no es válido' })
  role: Role;
}

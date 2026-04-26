import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';
// 🔥 ELIMINADO: import { Role } from '../../../prisma/generated/client';

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

  // 🔥 ACTUALIZADO: Ahora espera un String en lugar del viejo Enum de Prisma
  @ApiProperty({
    example: 'DOCENTE',
    description:
      'Nombre exacto del rol de acceso al sistema (ej. ADMIN, DOCENTE, SECRETARIA)',
  })
  @IsString({ message: 'El rol debe ser un texto' })
  @IsNotEmpty({ message: 'El rol es obligatorio' })
  role: string;
}

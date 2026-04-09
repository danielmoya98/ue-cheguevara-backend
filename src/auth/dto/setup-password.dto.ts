import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, IsJWT } from 'class-validator';

export class SetupPasswordDto {
  @ApiProperty({ description: 'Token temporal de configuración (JWT)' })
  @IsJWT({ message: 'El token de configuración proporcionado no es válido' })
  @IsNotEmpty({ message: 'El token de configuración es obligatorio' })
  setupToken: string;

  @ApiProperty({
    example: 'NuevaClaveDefinitiva*',
    description: 'Contraseña nueva del usuario',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @MinLength(6, {
    message: 'La nueva contraseña debe tener al menos 6 caracteres',
  })
  newPassword: string;
}

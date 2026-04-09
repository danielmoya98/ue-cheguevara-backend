import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'MiClaveActual123' })
  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar su contraseña actual' })
  currentPassword: string;

  @ApiProperty({ example: 'NuevaClaveSegura*' })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @MinLength(6, {
    message: 'La nueva contraseña debe tener mínimo 6 caracteres',
  })
  newPassword: string;
}

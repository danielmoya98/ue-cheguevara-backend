import { IsNotEmpty, IsString, MinLength, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterGuardianDto {
  @ApiProperty({
    description: 'Carnet de Identidad exacto registrado en el colegio',
  })
  @IsString()
  @IsNotEmpty()
  ci: string;

  @ApiProperty({ description: 'Contraseña para la App (Mínimo 6 caracteres)' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @ApiProperty({
    description:
      'Correo personal (Gmail, Hotmail, etc) para recuperar la cuenta',
  })
  @IsEmail({}, { message: 'Debe ser un correo electrónico válido' })
  @IsNotEmpty()
  recoveryEmail: string;
}

import {
  IsNotEmpty,
  IsString,
  MinLength,
  IsDateString,
  IsEmail,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterStudentDto {
  @ApiProperty({ description: 'Carnet de Identidad del alumno' })
  @IsString()
  @IsNotEmpty()
  ci: string;

  @ApiProperty({ description: 'Fecha de nacimiento (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  birthDate: string;

  @ApiProperty({ description: 'Contraseña elegida por el alumno' })
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

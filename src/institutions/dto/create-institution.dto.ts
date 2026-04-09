import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsEmail,
  IsInt,
  IsArray,
  ArrayNotEmpty,
  IsUUID,
} from 'class-validator';
import {
  DependencyType,
  Department,
  Shift,
  EducationLevel,
} from '../../../prisma/generated/client';

export class CreateInstitutionDto {
  @ApiProperty({
    example: '80730145',
    description: 'Código RUE o SIE de la institución',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código RUE es obligatorio' })
  rueCode: string;

  @ApiProperty({
    example: 'Unidad Educativa Che Guevara',
    description: 'Nombre oficial',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la institución es obligatorio' })
  name: string;

  @ApiProperty({ enum: DependencyType, example: DependencyType.FISCAL })
  @IsEnum(DependencyType, { message: 'Tipo de dependencia inválido' })
  dependencyType: DependencyType;

  @ApiProperty({ enum: Department, example: Department.CHUQUISACA })
  @IsEnum(Department, { message: 'Departamento inválido' })
  department: Department;

  @ApiProperty({ example: 'Sucre', description: 'Municipio' })
  @IsString()
  @IsNotEmpty({ message: 'El municipio es obligatorio' })
  municipality: string;

  @ApiProperty({ example: 'Sucre 1', description: 'Distrito Educativo' })
  @IsString()
  @IsNotEmpty({ message: 'El distrito educativo es obligatorio' })
  district: string;

  @ApiProperty({
    example: 'Zona Villa Armonía',
    description: 'Dirección física',
  })
  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  address: string;

  @ApiPropertyOptional({
    example: '46452311',
    description: 'Teléfono de contacto',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'colegio@uecheguevara.bo' })
  @IsOptional()
  @IsEmail({}, { message: 'El formato del correo institucional es inválido' })
  email?: string;

  @ApiPropertyOptional({ example: 2005 })
  @IsOptional()
  @IsInt({ message: 'El año de fundación debe ser un número entero' })
  foundedYear?: number;

  @ApiProperty({
    enum: Shift,
    isArray: true,
    example: [Shift.MANANA, Shift.TARDE],
    description: 'Turnos operativos',
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Debe especificar al menos un turno' })
  @IsEnum(Shift, { each: true, message: 'Turno inválido en el arreglo' })
  shifts: Shift[];

  @ApiProperty({
    enum: EducationLevel,
    isArray: true,
    example: [EducationLevel.PRIMARIA, EducationLevel.SECUNDARIA],
    description: 'Niveles educativos',
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Debe especificar al menos un nivel educativo' })
  @IsEnum(EducationLevel, {
    each: true,
    message: 'Nivel educativo inválido en el arreglo',
  })
  levels: EducationLevel[];

  @ApiPropertyOptional({
    description: 'UUID del usuario Administrador/Director',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El ID del director debe ser un UUID válido' })
  directorId?: string;
}

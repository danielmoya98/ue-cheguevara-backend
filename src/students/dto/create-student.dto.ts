import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, EnrollmentType } from '../../../prisma/generated/client';

class GuardianDto {
  @IsString() @IsNotEmpty() relationship: string;
  @IsString() @IsNotEmpty() ci: string;
  @IsString() @IsOptional() complement?: string;
  @IsString() @IsOptional() expedition?: string;
  @IsString() @IsNotEmpty() lastNamePaterno: string;
  @IsString() @IsOptional() lastNameMaterno?: string;
  @IsString() @IsNotEmpty() names: string;
  @IsString() @IsOptional() language?: string;
  @IsString() @IsOptional() occupation?: string;
  @IsString() @IsOptional() educationLevel?: string;
  @IsString() @IsOptional() birthDate?: string;
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsOptional() jobTitle?: string;
  @IsString() @IsOptional() institution?: string;
}

class RudeDataDto {
  // Dirección
  @IsString() @IsNotEmpty() department: string;
  @IsString() @IsNotEmpty() province: string;
  @IsString() @IsNotEmpty() municipality: string;
  @IsString() @IsOptional() locality?: string;
  @IsString() @IsOptional() zone?: string;
  @IsString() @IsNotEmpty() street: string;
  @IsString() @IsOptional() houseNumber?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsNotEmpty() cellphone: string;

  // Idioma y Cultura
  @IsString() @IsNotEmpty() nativeLanguage: string;
  @IsArray() @IsOptional() frequentLanguages?: string[];
  @IsString() @IsOptional() culturalIdentity?: string;

  // Salud
  @IsBoolean() @IsOptional() nearestHealthCenter?: boolean;
  @IsArray() @IsOptional() healthCareLocations?: string[];
  @IsString() @IsOptional() healthCenterVisits?: string;
  @IsBoolean() @IsOptional() healthInsurance?: boolean;

  // Servicios Básicos
  @IsBoolean() @IsOptional() water?: boolean;
  @IsBoolean() @IsOptional() bathroom?: boolean;
  @IsBoolean() @IsOptional() sewage?: boolean;
  @IsBoolean() @IsOptional() electricity?: boolean;
  @IsBoolean() @IsOptional() garbage?: boolean;
  @IsString() @IsOptional() housingType?: string;

  // Internet
  @IsArray() @IsOptional() internetAccess?: string[];
  @IsString() @IsOptional() internetFrequency?: string;

  // Trabajo
  @IsString() @IsOptional() didWork?: string;
  @IsArray() @IsOptional() workedMonths?: string[];
  @IsString() @IsOptional() workType?: string;
  @IsArray() @IsOptional() workShift?: string[];
  @IsString() @IsOptional() workFrequency?: string;
  @IsString() @IsOptional() gotPaid?: string;

  // Transporte
  @IsString() @IsNotEmpty() transportType: string;
  @IsString() @IsNotEmpty() transportTime: string;

  // Abandono
  @IsBoolean() @IsOptional() abandonedLastYear?: boolean;
  @IsArray() @IsOptional() abandonReasons?: string[];

  // Con quién vive
  @IsString() @IsNotEmpty() livesWith: string;
}

export class CreateFullRudeDto {
  @IsString() @IsNotEmpty() classroomId: string;
  @IsString() @IsNotEmpty() academicYearId: string;
  @IsEnum(EnrollmentType) @IsNotEmpty() enrollmentType: EnrollmentType;
  @IsString() @IsOptional() rudeCode?: string;

  // Datos del Estudiante
  @IsString() @IsOptional() ci?: string;
  @IsString() @IsOptional() complement?: string;
  @IsString() @IsOptional() expedition?: string;
  @IsString() @IsNotEmpty() documentType: string;
  @IsString() @IsNotEmpty() names: string;
  @IsString() @IsNotEmpty() lastNamePaterno: string;
  @IsString() @IsOptional() lastNameMaterno?: string;
  @IsDateString() @IsNotEmpty() birthDate: string;
  @IsEnum(Gender) @IsNotEmpty() gender: Gender;

  @IsString() @IsNotEmpty() birthCountry: string;
  @IsString() @IsOptional() birthDepartment?: string;
  @IsString() @IsOptional() birthProvince?: string;
  @IsString() @IsOptional() birthLocality?: string;

  @IsString() @IsOptional() certOficialia?: string;
  @IsString() @IsOptional() certLibro?: string;
  @IsString() @IsOptional() certPartida?: string;
  @IsString() @IsOptional() certFolio?: string;

  // Capacidades Especiales
  @IsBoolean() @IsOptional() hasDisability?: boolean;
  @IsString() @IsOptional() disabilityRegistry?: string;
  @IsString() @IsOptional() disabilityCode?: string;
  @IsString() @IsOptional() disabilityType?: string;
  @IsString() @IsOptional() disabilityDegree?: string;
  @IsString() @IsOptional() disabilityOrigin?: string;

  @IsBoolean() @IsOptional() hasAutism?: boolean;
  @IsString() @IsOptional() autismType?: string;

  @IsString() @IsOptional() learningDisabilityStatus?: string;
  @IsArray() @IsOptional() learningDisabilityTypes?: string[];
  @IsArray() @IsOptional() learningSupportLocation?: string[];

  @IsBoolean() @IsOptional() hasExtraordinaryTalent?: boolean;
  @IsString() @IsOptional() talentType?: string;
  @IsArray() @IsOptional() talentSpecifics?: string[];
  @IsString() @IsOptional() talentIQ?: string;
  @IsArray() @IsOptional() talentModality?: string[];

  // Relaciones
  @ValidateNested({ each: true })
  @Type(() => GuardianDto)
  @IsArray()
  guardians: GuardianDto[];

  @ValidateNested()
  @Type(() => RudeDataDto)
  @IsOptional()
  rudeData?: RudeDataDto;
}

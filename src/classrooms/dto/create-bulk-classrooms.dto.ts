import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsUUID,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsArray,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EducationLevel, Shift } from '../../../prisma/generated/client';

class ClassroomItemDto {
  @IsString() @IsNotEmpty() grade: string;
  @IsString() @IsNotEmpty() section: string;
  @IsInt() @Min(10) @Max(50) capacity: number;

  @ApiProperty({ example: 'uuid-del-aula', required: false })
  @IsUUID()
  @IsOptional()
  baseRoomId?: string;
}

export class CreateBulkClassroomsDto {
  @ApiProperty({ example: 'uuid-del-año' })
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  @ApiProperty({ enum: EducationLevel })
  @IsEnum(EducationLevel)
  level: EducationLevel;

  @ApiProperty({ enum: Shift })
  @IsEnum(Shift)
  shift: Shift;

  @ApiProperty({ type: [ClassroomItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassroomItemDto)
  classrooms: ClassroomItemDto[];
}

import { IsUUID, IsString, IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChangeRequestDto {
  @ApiProperty()
  @IsUUID()
  gradeId!: string;

  @ApiProperty()
  @IsString()
  reason!: string; // La justificación del profesor

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10)
  proposedSer?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(45)
  proposedSaber?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(40)
  proposedHacer?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(5)
  proposedAuto?: number;
}
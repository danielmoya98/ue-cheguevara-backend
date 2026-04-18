import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { AttendanceMethod } from '../../../prisma/generated/client';

export class RegisterAttendanceDto {
  @ApiProperty({ description: 'El token completo leído por el escáner QR' })
  @IsString()
  @IsNotEmpty()
  qrToken: string;

  @ApiProperty({ description: 'ID del periodo de clase actual (Ej. 1ra Hora)' })
  @IsUUID()
  @IsNotEmpty()
  classPeriodId: string;

  @ApiProperty({ enum: AttendanceMethod, default: AttendanceMethod.QR })
  @IsEnum(AttendanceMethod)
  @IsOptional()
  method?: AttendanceMethod;
}
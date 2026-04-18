import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsEnum } from 'class-validator';
import { AttendanceStatus } from '../../../prisma/generated/client';

export class ManualAttendanceDto {
  @ApiProperty({ description: 'ID de la inscripción del alumno' })
  @IsUUID()
  @IsNotEmpty()
  enrollmentId: string;

  @ApiProperty({ description: 'ID del periodo de clase' })
  @IsUUID()
  @IsNotEmpty()
  classPeriodId: string;

  @ApiProperty({ enum: AttendanceStatus, description: 'PRESENT, LATE, ABSENT o EXCUSED' })
  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status: AttendanceStatus;
}
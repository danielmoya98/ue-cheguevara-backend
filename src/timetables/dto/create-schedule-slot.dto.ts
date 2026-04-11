import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsOptional,
} from 'class-validator';

export class CreateScheduleSlotDto {
  @ApiProperty({ description: 'Día de la semana (1 = Lunes, 5 = Viernes)' })
  @IsInt()
  @Min(1)
  @Max(5)
  dayOfWeek: number;

  @ApiProperty({ description: 'ID del periodo de clase (Ej. 1er Periodo)' })
  @IsUUID()
  @IsNotEmpty()
  classPeriodId: string;

  @ApiProperty({ description: 'ID de la asignación (La materia y el profe)' })
  @IsUUID()
  @IsNotEmpty()
  teacherAssignmentId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  classroomId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  teacherId: string;

  // 🔥 NUEVO: El aula física donde se pasará la clase
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  physicalSpaceId?: string;
}

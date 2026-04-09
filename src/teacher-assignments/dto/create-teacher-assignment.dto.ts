import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateTeacherAssignmentDto {
  @ApiProperty({ description: 'ID del curso/paralelo' })
  @IsUUID()
  @IsNotEmpty()
  classroomId: string;

  @ApiProperty({ description: 'ID de la materia/asignatura' })
  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ description: 'ID del docente asignado' })
  @IsUUID()
  @IsNotEmpty()
  teacherId: string;
}

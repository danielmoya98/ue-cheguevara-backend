import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AssignmentItemDto {
  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @IsUUID()
  @IsNotEmpty()
  teacherId: string;
}

export class CloneAssignmentsDto {
  @ApiProperty({
    description: 'IDs de los cursos a los que vamos a copiar la carga horaria',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  targetClassroomIds: string[];

  @ApiProperty({ description: 'Lista de materias y docentes a clonar' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentItemDto)
  assignments: AssignmentItemDto[];
}

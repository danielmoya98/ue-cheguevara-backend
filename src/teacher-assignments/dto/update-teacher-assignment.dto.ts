import { PartialType } from '@nestjs/swagger';
import { CreateTeacherAssignmentDto } from './create-teacher-assignment.dto';

export class UpdateTeacherAssignmentDto extends PartialType(CreateTeacherAssignmentDto) {}

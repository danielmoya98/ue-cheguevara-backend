import { Module } from '@nestjs/common';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { TeacherAssignmentsController } from './teacher-assignments.controller';

@Module({
  controllers: [TeacherAssignmentsController],
  providers: [TeacherAssignmentsService],
})
export class TeacherAssignmentsModule {}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../prisma/generated/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { CloneAssignmentsDto } from './dto/clone-assignments.dto';

@ApiTags('Carga Horaria (Asignación)')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('teacher-assignments')
export class TeacherAssignmentsController {
  constructor(
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Asigna un docente a una materia en un curso específico',
  })
  create(@Body() createTeacherAssignmentDto: CreateTeacherAssignmentDto) {
    return this.teacherAssignmentsService.create(createTeacherAssignmentDto);
  }

  @Post('clone')
  @Roles(Role.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Clona carga horaria seleccionada hacia otros paralelos',
  })
  clone(@Body() cloneAssignmentsDto: CloneAssignmentsDto) {
    return this.teacherAssignmentsService.cloneAssignments(cloneAssignmentsDto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Obtiene el listado de carga horaria (filtrable por curso, docente o gestión)',
  })
  findAll(
    @Query()
    query: PaginationDto & {
      academicYearId?: string;
      classroomId?: string;
      teacherId?: string;
    },
  ) {
    return this.teacherAssignmentsService.findAll(query);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina una asignación de carga horaria' })
  remove(@Param('id') id: string) {
    return this.teacherAssignmentsService.remove(id);
  }
}

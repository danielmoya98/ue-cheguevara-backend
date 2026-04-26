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
  Req,
} from '@nestjs/common';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { CloneAssignmentsDto } from './dto/clone-assignments.dto';

// 🔥 IMPORTACIONES RBAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Carga Horaria (Asignación)')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
@Controller('teacher-assignments')
export class TeacherAssignmentsController {
  constructor(
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
  ) {}

  @Post()
  @RequirePermissions(SystemPermissions.TEACHER_ASSIGNMENTS_WRITE) // 🔥 Solo Admin
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Asigna un docente a una materia en un curso específico',
  })
  create(@Body() createTeacherAssignmentDto: CreateTeacherAssignmentDto) {
    return this.teacherAssignmentsService.create(createTeacherAssignmentDto);
  }

  @Post('clone')
  @RequirePermissions(SystemPermissions.TEACHER_ASSIGNMENTS_WRITE) // 🔥 Solo Admin
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Clona carga horaria seleccionada hacia otros paralelos',
  })
  clone(@Body() cloneAssignmentsDto: CloneAssignmentsDto) {
    return this.teacherAssignmentsService.cloneAssignments(cloneAssignmentsDto);
  }

  @Get()
  @RequirePermissions(SystemPermissions.TEACHER_ASSIGNMENTS_READ)
  @ApiOperation({ summary: 'Obtiene el listado de carga horaria' })
  findAll(
    @Query()
    query: PaginationDto & {
      academicYearId?: string;
      classroomId?: string;
      teacherId?: string;
    },
    @Req() req: any,
  ) {
    // 🔥 Pasamos el usuario para que el servicio aplique ABAC
    return this.teacherAssignmentsService.findAll(query, req.user);
  }

  @Delete(':id')
  @RequirePermissions(SystemPermissions.TEACHER_ASSIGNMENTS_WRITE) // 🔥 Solo Admin
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina una asignación de carga horaria' })
  remove(@Param('id') id: string) {
    return this.teacherAssignmentsService.remove(id);
  }
}

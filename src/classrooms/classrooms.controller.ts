import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { CreateBulkClassroomsDto } from './dto/create-bulk-classrooms.dto';

// 🔥 IMPORTACIONES ABAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Cursos y Paralelos')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  @RequirePermissions(SystemPermissions.MANAGE_ALL_CLASSROOM) // 🔥 ABAC: Solo Dirección
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Crea un nuevo curso/paralelo' })
  create(@Body() createClassroomDto: CreateClassroomDto) {
    return this.classroomsService.create(createClassroomDto);
  }

  @Post('bulk')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_CLASSROOM) // 🔥 ABAC: Solo Dirección
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Crea múltiples cursos masivamente' })
  createBulk(@Body() createBulkDto: CreateBulkClassroomsDto) {
    return this.classroomsService.createBulk(createBulkDto);
  }

  @Get()
  // 🔓 Lectura abierta. Pero le pasamos req.user para que el servicio filtre qué cursos puede ver el docente.
  @ApiOperation({ summary: 'Obtiene el listado de cursos filtrado' })
  findAll(
    @Query()
    query: PaginationDto & {
      academicYearId?: string;
      level?: string;
      shift?: string;
    },
    @Req() req: any, // 🔥 Inyectamos el usuario
  ) {
    return this.classroomsService.findAll(query, req.user);
  }

  @Get(':id')
  // 🔓 Lectura abierta (Solo requiere JWT)
  @ApiOperation({ summary: 'Obtiene un curso por su ID' })
  findOne(@Param('id') id: string) {
    return this.classroomsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_CLASSROOM) // 🔥 ABAC: Solo Dirección
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza los datos o el tutor de un curso' })
  update(
    @Param('id') id: string,
    @Body() updateClassroomDto: UpdateClassroomDto,
  ) {
    return this.classroomsService.update(id, updateClassroomDto);
  }

  @Delete(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_CLASSROOM) // 🔥 ABAC: Solo Dirección
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina un curso (si no tiene alumnos)' })
  remove(@Param('id') id: string) {
    return this.classroomsService.remove(id);
  }
}

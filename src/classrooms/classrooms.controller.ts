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
} from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, Shift } from '../../prisma/generated/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { CreateBulkClassroomsDto } from './dto/create-bulk-classrooms.dto';

@ApiTags('Cursos y Paralelos')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @UseInterceptors(IdempotencyInterceptor) // 🛡️ Protección contra clics dobles
  @ApiOperation({ summary: 'Crea un nuevo curso/paralelo (Solo ADMIN)' })
  create(@Body() createClassroomDto: CreateClassroomDto) {
    return this.classroomsService.create(createClassroomDto);
  }

  @Post('bulk')
  @Roles(Role.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Crea múltiples cursos masivamente (Solo ADMIN)' })
  createBulk(@Body() createBulkDto: CreateBulkClassroomsDto) {
    return this.classroomsService.createBulk(createBulkDto);
  }

  @Get()
  // ⚡ SIN CACHÉ: Lectura en tiempo real para el panel de administración
  @ApiOperation({
    summary: 'Obtiene el listado de cursos filtrado por gestión, nivel y turno',
  })
  findAll(
    // 🔥 Agregamos level y shift al tipado del Query
    @Query()
    query: PaginationDto & {
      academicYearId?: string;
      level?: string;
      shift?: string;
    },
  ) {
    return this.classroomsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un curso por su ID' })
  findOne(@Param('id') id: string) {
    return this.classroomsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza los datos o el tutor de un curso' })
  update(
    @Param('id') id: string,
    @Body() updateClassroomDto: UpdateClassroomDto,
  ) {
    return this.classroomsService.update(id, updateClassroomDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina un curso (si no tiene alumnos)' })
  remove(@Param('id') id: string) {
    return this.classroomsService.remove(id);
  }
}

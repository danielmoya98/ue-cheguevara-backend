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
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { EducationLevel } from '../../prisma/generated/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

// 🔥 IMPORTACIONES RBAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Catálogo de Materias')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Candados Activados
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @RequirePermissions(SystemPermissions.SUBJECTS_WRITE) // 🔥 Solo Administradores
  @UseInterceptors(IdempotencyInterceptor) // Escudo Anti-rebotes
  @ApiOperation({ summary: 'Registra una nueva materia en el catálogo' })
  create(@Body() createSubjectDto: CreateSubjectDto) {
    return this.subjectsService.create(createSubjectDto);
  }

  @Get()
  // 🔓 Sin @RequirePermissions: Lectura abierta para usuarios logueados (útil para selects)
  @ApiOperation({
    summary: 'Obtiene el listado de materias (soporta filtro por nivel)',
  })
  findAll(@Query() query: PaginationDto & { level?: EducationLevel }) {
    return this.subjectsService.findAll(query);
  }

  @Get(':id')
  // 🔓 Lectura abierta
  @ApiOperation({ summary: 'Obtiene una materia por su ID' })
  findOne(@Param('id') id: string) {
    return this.subjectsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(SystemPermissions.SUBJECTS_WRITE) // 🔥 Solo Administradores
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza los datos de una materia' })
  update(@Param('id') id: string, @Body() updateSubjectDto: UpdateSubjectDto) {
    return this.subjectsService.update(id, updateSubjectDto);
  }

  @Delete(':id')
  @RequirePermissions(SystemPermissions.SUBJECTS_WRITE) // 🔥 Solo Administradores
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina una materia del catálogo' })
  remove(@Param('id') id: string) {
    return this.subjectsService.remove(id);
  }
}

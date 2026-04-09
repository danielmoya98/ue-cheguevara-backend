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
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../prisma/generated/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
// ❌ Eliminamos CacheInterceptor y CacheTTL de aquí

@ApiTags('Gestión Académica')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  // =======================================================
  // ENDPOINTS DE LECTURA (SIN CACHÉ REDIS - TIEMPO REAL)
  // React Query en el frontend ya se encarga de no saturar esta ruta
  // =======================================================

  @Get('current')
  @ApiOperation({ summary: 'Obtiene la gestión académica ACTIVA actual' })
  findCurrentActive() {
    return this.academicYearsService.findCurrentActive();
  }

  @Get()
  @ApiOperation({ summary: 'Obtiene el listado de gestiones académicas' })
  findAll(@Query() query: PaginationDto) {
    return this.academicYearsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una gestión por su ID' })
  findOne(@Param('id') id: string) {
    return this.academicYearsService.findOne(id);
  }

  // =======================================================
  // ENDPOINTS ADMINISTRATIVOS (CON IDEMPOTENCIA)
  // =======================================================

  @Post()
  @Roles(Role.ADMIN)
  @UseInterceptors(IdempotencyInterceptor) // ✅ Este escudo SÍ se queda
  @ApiOperation({ summary: 'Crea una nueva gestión escolar (Solo ADMIN)' })
  create(@Body() createAcademicYearDto: CreateAcademicYearDto) {
    return this.academicYearsService.create(createAcademicYearDto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza los datos de una gestión (Solo ADMIN)' })
  update(
    @Param('id') id: string,
    @Body() updateAcademicYearDto: UpdateAcademicYearDto,
  ) {
    return this.academicYearsService.update(id, updateAcademicYearDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina una gestión si no tiene cursos asignados' })
  remove(@Param('id') id: string) {
    return this.academicYearsService.remove(id);
  }
}

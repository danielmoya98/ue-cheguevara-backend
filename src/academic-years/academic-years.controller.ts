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
import { PaginationDto } from '../common/dto/pagination.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

// 🔥 IMPORTACIONES DE LA NUEVA SEGURIDAD ABAC
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant'; // 🔥 Enum Oficial

@ApiTags('Gestión Académica')
@ApiCookieAuth('uecg_access_token')
// 🔥 El guardián interceptará y validará el formato ABAC
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  // =======================================================
  // ENDPOINTS DE LECTURA
  // (Sin @RequirePermissions: Abiertos a cualquier usuario logueado
  // porque TODOS necesitan saber cuál es la gestión actual)
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
  // ENDPOINTS ADMINISTRATIVOS (Requieren Permisos ABAC estrictos)
  // =======================================================

  @Post()
  @RequirePermissions(SystemPermissions.MANAGE_ALL_ACADEMIC_YEAR) // 🔥 Usando el Enum
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Crea una nueva gestión escolar' })
  create(@Body() createAcademicYearDto: CreateAcademicYearDto) {
    return this.academicYearsService.create(createAcademicYearDto);
  }

  @Patch(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_ACADEMIC_YEAR) // 🔥 Usando el Enum
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza los datos de una gestión' })
  update(
    @Param('id') id: string,
    @Body() updateAcademicYearDto: UpdateAcademicYearDto,
  ) {
    return this.academicYearsService.update(id, updateAcademicYearDto);
  }

  @Delete(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_ACADEMIC_YEAR) // 🔥 Usando el Enum
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Elimina una gestión si no tiene cursos asignados' })
  remove(@Param('id') id: string) {
    return this.academicYearsService.remove(id);
  }
}

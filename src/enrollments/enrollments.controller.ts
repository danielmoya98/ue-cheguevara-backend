import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../prisma/generated/client';

@ApiTags('Inscripciones')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({ summary: 'Crea una nueva inscripción manualmente' })
  create(@Body() createEnrollmentDto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(createEnrollmentDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Obtiene el listado de inscripciones con filtros y paginación',
  })
  findAll(@Query() query: QueryEnrollmentDto) {
    return this.enrollmentsService.findAll(query);
  }

  // 🔥 NUEVO ENDPOINT LIGERO: Para el Kardex del Frontend
  // IMPORTANTE: Este endpoint debe ir ANTES de `/:id`
  @Get(':id/kardex')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Obtiene un resumen ligero del estudiante para el Kardex',
  })
  findKardex(@Param('id') id: string) {
    return this.enrollmentsService.findKardex(id);
  }

  // (INTACTO) Este endpoint pesado sigue alimentando al PDF
  @Get(':id')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Obtiene los detalles completos para el Formulario RUDE',
  })
  findOne(@Param('id') id: string) {
    return this.enrollmentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({ summary: 'Actualiza una inscripción o estado' })
  update(
    @Param('id') id: string,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentsService.update(id, updateEnrollmentDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.enrollmentsService.remove(id);
  }

  @Get(':id/rude-pdf')
  @ApiCookieAuth('uecg_access_token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @ApiOperation({ summary: 'Genera el PDF oficial del RUDE para el SIE' })
  async generateRudePdf(@Param('id') id: string, @Res() res: Response) {
    // 🚧 AQUÍ EN EL FUTURO:
    // const data = await this.enrollmentsService.getKardex(id);
    // const pdfBuffer = await this.pdfService.generateRude(data);

    // POR AHORA: Retornamos un estado para indicar que la arquitectura está lista
    return {
      status: 'READY_FOR_INTEGRATION',
      message:
        'El endpoint está construido. Requiere inyectar el motor de plantillas PDF para el formato SIE.',
    };
  }

  
}

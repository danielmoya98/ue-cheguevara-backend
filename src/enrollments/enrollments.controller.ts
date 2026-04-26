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
  Req,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

// 🔥 IMPORTACIONES RBAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Inscripciones')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @RequirePermissions(SystemPermissions.ENROLLMENTS_WRITE)
  @ApiOperation({ summary: 'Crea una nueva inscripción manualmente' })
  create(@Body() createEnrollmentDto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(createEnrollmentDto);
  }

  @Get()
  @RequirePermissions(SystemPermissions.ENROLLMENTS_READ) // 🔥 Secretaria y Docente
  @ApiOperation({ summary: 'Obtiene el listado de inscripciones' })
  findAll(@Query() query: QueryEnrollmentDto, @Req() req: any) {
    return this.enrollmentsService.findAll(query, req.user);
  }

  @Get(':id/kardex')
  @RequirePermissions(SystemPermissions.ENROLLMENTS_READ)
  @ApiOperation({
    summary: 'Obtiene un resumen ligero del estudiante para el Kardex',
  })
  findKardex(@Param('id') id: string, @Req() req: any) {
    return this.enrollmentsService.findKardex(id, req.user);
  }

  @Get(':id')
  @RequirePermissions(SystemPermissions.ENROLLMENTS_READ)
  @ApiOperation({
    summary: 'Obtiene los detalles completos para el Formulario RUDE',
  })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.enrollmentsService.findOne(id, req.user);
  }

  @Patch(':id')
  @RequirePermissions(SystemPermissions.ENROLLMENTS_WRITE)
  @ApiOperation({ summary: 'Actualiza una inscripción o estado' })
  update(
    @Param('id') id: string,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentsService.update(id, updateEnrollmentDto);
  }

  @Delete(':id')
  @RequirePermissions(SystemPermissions.ENROLLMENTS_DELETE)
  remove(@Param('id') id: string) {
    return this.enrollmentsService.remove(id);
  }

  @Get(':id/rude-pdf')
  @RequirePermissions(SystemPermissions.ENROLLMENTS_READ)
  @ApiOperation({ summary: 'Genera el PDF oficial del RUDE para el SIE' })
  async generateRudePdf(@Param('id') id: string, @Res() res: any) {
    return {
      status: 'READY_FOR_INTEGRATION',
      message:
        'Requiere inyectar el motor de plantillas PDF para el formato SIE.',
    };
  }
}

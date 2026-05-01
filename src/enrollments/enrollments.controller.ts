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

import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Inscripciones')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @RequirePermissions(SystemPermissions.WRITE_ANY_ENROLLMENT)
  @ApiOperation({ summary: 'Crea una nueva inscripción manualmente' })
  create(@Body() createEnrollmentDto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(createEnrollmentDto);
  }

  @Get()
  // 🔥 Acepta Admin (ALL) o Docente (OWN)
  @RequirePermissions(
    SystemPermissions.READ_ALL_ENROLLMENT,
    SystemPermissions.READ_OWN_ENROLLMENT,
  )
  @ApiOperation({ summary: 'Obtiene el listado de inscripciones' })
  findAll(@Query() query: QueryEnrollmentDto, @Req() req: any) {
    return this.enrollmentsService.findAll(query, req.user);
  }

  @Get(':id/kardex')
  // 🔥 Acepta Admin (ALL) o Docente (OWN)
  @RequirePermissions(
    SystemPermissions.READ_ALL_ENROLLMENT,
    SystemPermissions.READ_OWN_ENROLLMENT,
  )
  @ApiOperation({
    summary: 'Obtiene un resumen ligero del estudiante para el Kardex',
  })
  findKardex(@Param('id') id: string, @Req() req: any) {
    return this.enrollmentsService.findKardex(id, req.user);
  }

  @Get(':id')
  // 🔥 Acepta Admin (ALL) o Docente (OWN)
  @RequirePermissions(
    SystemPermissions.READ_ALL_ENROLLMENT,
    SystemPermissions.READ_OWN_ENROLLMENT,
  )
  @ApiOperation({
    summary: 'Obtiene los detalles completos para el Formulario RUDE',
  })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.enrollmentsService.findOne(id, req.user);
  }

  @Patch(':id')
  @RequirePermissions(SystemPermissions.WRITE_ANY_ENROLLMENT)
  @ApiOperation({ summary: 'Actualiza una inscripción o estado' })
  update(
    @Param('id') id: string,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentsService.update(id, updateEnrollmentDto);
  }

  @Delete(':id')
  @RequirePermissions(SystemPermissions.WRITE_ANY_ENROLLMENT)
  remove(@Param('id') id: string) {
    return this.enrollmentsService.remove(id);
  }

  @Get(':id/rude-pdf')
  // 🔥 Acepta Admin (ALL) o Docente (OWN)
  @RequirePermissions(
    SystemPermissions.READ_ALL_ENROLLMENT,
    SystemPermissions.READ_OWN_ENROLLMENT,
  )
  @ApiOperation({ summary: 'Genera el PDF oficial del RUDE para el SIE' })
  async generateRudePdf(@Param('id') id: string, @Res() res: any) {
    return {
      status: 'READY_FOR_INTEGRATION',
      message:
        'Requiere inyectar el motor de plantillas PDF para el formato SIE.',
    };
  }
}

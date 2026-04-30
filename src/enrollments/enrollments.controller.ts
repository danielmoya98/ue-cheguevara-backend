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
import { EnrollmentsPolicy } from './enrollments.policy';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

// 🔥 IMPORTACIONES ABAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Inscripciones')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    private readonly enrollmentsPolicy: EnrollmentsPolicy,
  ) {}

  @Post()
  @RequirePermissions(SystemPermissions.WRITE_ANY_ENROLLMENT) // 🔥 ABAC
  @ApiOperation({ summary: 'Crea una nueva inscripción manualmente' })
  create(@Body() createEnrollmentDto: CreateEnrollmentDto, @Req() req: any) {
    this.enrollmentsPolicy.canWrite(req.user); // 🔥 Política interna validando
    return this.enrollmentsService.create(createEnrollmentDto);
  }

  @Get()
  @RequirePermissions(SystemPermissions.READ_ALL_ENROLLMENT) // 🔥 ABAC
  @ApiOperation({ summary: 'Obtiene el listado de inscripciones' })
  findAll(@Query() query: QueryEnrollmentDto, @Req() req: any) {
    const scope = this.enrollmentsPolicy.getReadScope(req.user);
    return this.enrollmentsService.findAll(query, scope);
  }

  @Get(':id/kardex')
  @RequirePermissions(SystemPermissions.READ_ALL_ENROLLMENT) // 🔥 ABAC
  @ApiOperation({
    summary: 'Obtiene un resumen ligero del estudiante para el Kardex',
  })
  findKardex(@Param('id') id: string, @Req() req: any) {
    const scope = this.enrollmentsPolicy.getReadScope(req.user);
    return this.enrollmentsService.findKardex(id, scope);
  }

  @Get(':id')
  @RequirePermissions(SystemPermissions.READ_ALL_ENROLLMENT) // 🔥 ABAC
  @ApiOperation({
    summary: 'Obtiene los detalles completos para el Formulario RUDE',
  })
  findOne(@Param('id') id: string, @Req() req: any) {
    const scope = this.enrollmentsPolicy.getReadScope(req.user);
    return this.enrollmentsService.findOne(id, scope);
  }

  @Patch(':id')
  @RequirePermissions(SystemPermissions.WRITE_ANY_ENROLLMENT) // 🔥 ABAC
  @ApiOperation({ summary: 'Actualiza una inscripción o estado' })
  update(
    @Param('id') id: string,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
    @Req() req: any,
  ) {
    this.enrollmentsPolicy.canWrite(req.user);
    return this.enrollmentsService.update(id, updateEnrollmentDto);
  }

  @Delete(':id')
  @RequirePermissions(SystemPermissions.WRITE_ANY_ENROLLMENT) // 🔥 ABAC (Aplica a Delete también)
  remove(@Param('id') id: string, @Req() req: any) {
    this.enrollmentsPolicy.canWrite(req.user);
    return this.enrollmentsService.remove(id);
  }

  @Get(':id/rude-pdf')
  @RequirePermissions(SystemPermissions.READ_ALL_ENROLLMENT) // 🔥 ABAC
  @ApiOperation({ summary: 'Genera el PDF oficial del RUDE para el SIE' })
  async generateRudePdf(
    @Param('id') id: string,
    @Res() res: any,
    @Req() req: any,
  ) {
    this.enrollmentsPolicy.getReadScope(req.user);

    return {
      status: 'READY_FOR_INTEGRATION',
      message:
        'Requiere inyectar el motor de plantillas PDF para el formato SIE.',
    };
  }
}

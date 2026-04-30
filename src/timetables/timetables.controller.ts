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
  Res,
  Patch,
} from '@nestjs/common';
import { TimetablesService } from './timetables.service';
import { CreateScheduleSlotDto } from './dto/create-schedule-slot.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { Shift } from '../../prisma/generated/client';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import type { Response } from 'express'; // 🔥 CORRECCIÓN: 'import type' para interfaces
// 🔥 IMPORTACIONES ABAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Horarios Escolares')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
@Controller('timetables')
export class TimetablesController {
  constructor(private readonly timetablesService: TimetablesService) {}

  @Get('periods')
  // 🔓 Sin @RequirePermissions: Lectura abierta para poder armar la grilla en el Frontend
  @ApiOperation({
    summary: 'Obtiene la estructura base de los periodos según el turno',
  })
  getPeriods(@Query('shift') shift: Shift) {
    return this.timetablesService.getPeriods(shift || Shift.MANANA);
  }

  @Get('classroom/:id')
  // 🔓 Lectura abierta: Docentes y alumnos necesitan ver el horario
  @ApiOperation({
    summary: 'Obtiene todos los casilleros ocupados por un curso',
  })
  getClassroomSchedule(@Param('id') classroomId: string) {
    return this.timetablesService.getClassroomSchedule(classroomId);
  }

  @Post('slot')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_TIMETABLE) // 🔥 ABAC: Solo Gestores
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Asigna una materia a un casillero' })
  createSlot(@Body() createScheduleSlotDto: CreateScheduleSlotDto) {
    return this.timetablesService.createSlot(createScheduleSlotDto);
  }

  @Delete('slot/:id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_TIMETABLE) // 🔥 ABAC: Solo Gestores
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Libera un casillero' })
  removeSlot(@Param('id') id: string) {
    return this.timetablesService.removeSlot(id);
  }

  // ==============================================
  // RUTAS DE EXPORTACIÓN
  // ==============================================

  @Get('export/pdf/:classroomId')
  // 🔓 Lectura abierta: Cualquiera puede descargar el PDF de un curso específico
  @ApiOperation({ summary: 'Descarga el horario de un curso en PDF' })
  exportPdf(@Param('classroomId') classroomId: string, @Res() res: Response) {
    return this.timetablesService.exportSinglePdf(classroomId, res);
  }

  @Post('export/zip/start/:academicYearId')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_TIMETABLE) // 🔥 ABAC: Acción pesada, solo Administradores
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Añade la generación de ZIP a la cola (Asíncrono)' })
  startZipExport(@Param('academicYearId') academicYearId: string) {
    return this.timetablesService.requestMassiveZip(academicYearId);
  }

  @Get('export/zip/download/:fileName')
  // 🔓 Abierto temporalmente mediante token de descarga, o protegido si el frontend inyecta la cookie
  @ApiOperation({ summary: 'Descarga un ZIP ya generado por el Worker' })
  downloadZip(@Param('fileName') fileName: string, @Res() res: Response) {
    return this.timetablesService.downloadZip(fileName, res);
  }

  @Patch('slot/:id/space')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_TIMETABLE) // 🔥 ABAC: Solo Gestores
  @ApiOperation({
    summary: 'Cambia el aula física de una materia específica en el horario',
  })
  async updateSlotSpace(
    @Param('id') id: string,
    @Body('physicalSpaceId') physicalSpaceId: string | null,
  ) {
    return this.timetablesService.updateSlotSpace(id, physicalSpaceId);
  }
}

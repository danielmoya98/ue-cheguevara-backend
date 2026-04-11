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
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, Shift } from '../../prisma/generated/client';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import express from 'express';

@ApiTags('Horarios Escolares')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('timetables')
export class TimetablesController {
  constructor(private readonly timetablesService: TimetablesService) {}

  @Get('periods')
  @ApiOperation({
    summary: 'Obtiene la estructura base de los periodos según el turno',
  })
  getPeriods(@Query('shift') shift: Shift) {
    return this.timetablesService.getPeriods(shift || Shift.MANANA);
  }

  @Get('classroom/:id')
  @ApiOperation({
    summary: 'Obtiene todos los casilleros ocupados por un curso',
  })
  getClassroomSchedule(@Param('id') classroomId: string) {
    return this.timetablesService.getClassroomSchedule(classroomId);
  }

  @Post('slot')
  @Roles(Role.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Asigna una materia a un casillero' })
  createSlot(@Body() createScheduleSlotDto: CreateScheduleSlotDto) {
    return this.timetablesService.createSlot(createScheduleSlotDto);
  }

  @Delete('slot/:id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Libera un casillero' })
  removeSlot(@Param('id') id: string) {
    return this.timetablesService.removeSlot(id);
  }

  // ==============================================
  // RUTAS DE EXPORTACIÓN
  // ==============================================

  @Get('export/pdf/:classroomId')
  @ApiOperation({ summary: 'Descarga el horario de un curso en PDF' })
  exportPdf(
    @Param('classroomId') classroomId: string,
    @Res() res: express.Response,
  ) {
    return this.timetablesService.exportSinglePdf(classroomId, res);
  }

  @Post('export/zip/start/:academicYearId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Añade la generación de ZIP a la cola (Asíncrono)' })
  startZipExport(@Param('academicYearId') academicYearId: string) {
    return this.timetablesService.requestMassiveZip(academicYearId);
  }

  @Get('export/zip/download/:fileName')
  @ApiOperation({ summary: 'Descarga un ZIP ya generado por el Worker' })
  downloadZip(
    @Param('fileName') fileName: string,
    @Res() res: express.Response,
  ) {
    return this.timetablesService.downloadZip(fileName, res);
  }

  @Patch('slot/:id/space')
  @Roles(Role.ADMIN)
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

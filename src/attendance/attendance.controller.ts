import {
  Controller,
  Post,
  Patch,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { RegisterAttendanceDto } from './dto/register-attendance.dto';
import { GetMonitorDto } from './dto/get-monitor.dto';
import { ManualAttendanceDto } from './dto/manual-attendance.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Control de Asistencia')
@ApiCookieAuth('uecg_access_token')
@Controller('attendance')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('schedule')
  @RequirePermissions(SystemPermissions.READ_OWN_TIMETABLE)
  @ApiOperation({ summary: 'Obtiene el horario del día AGRUPADO EN BLOQUES' })
  async getDailySchedule(@Query('date') date: string, @Req() req: any) {
    return this.attendanceService.getDailySchedule(date, req.user);
  }

  @Get('classroom')
  @RequirePermissions(SystemPermissions.CREATE_OWN_ATTENDANCE)
  @ApiOperation({
    summary: 'Obtiene alumnos usando el primer periodo del bloque',
  })
  async getClassroomAttendance(
    @Query('classroomId') classroomId: string,
    @Query('classPeriodId') classPeriodId: string, // Usaremos el primer ID del bloque para consultar
    @Query('date') date: string,
    @Req() req: any,
  ) {
    return this.attendanceService.getClassroomAttendance(
      classroomId,
      classPeriodId,
      date,
      req.user,
    );
  }

  @Post('bulk')
  @RequirePermissions(SystemPermissions.CREATE_OWN_ATTENDANCE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Guarda la asistencia masiva en múltiples periodos',
  })
  async saveBulkAttendance(@Body() bulkData: any, @Req() req: any) {
    // bulkData ahora recibirá { classPeriodIds: ['id1', 'id2'], ... }
    return this.attendanceService.saveBulkAttendance(bulkData, req.user);
  }

  @Post('scan')
  @RequirePermissions(
    SystemPermissions.CREATE_OWN_ATTENDANCE,
    SystemPermissions.MANAGE_ALL_ATTENDANCE,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registra asistencia mediante escaneo QR para un bloque',
  })
  async scanQR(@Body() dto: any, @Req() req: any) {
    // dto ahora recibirá classPeriodIds: string[]
    return this.attendanceService.registerScan(dto, req.user);
  }

  @Get('monitor')
  @RequirePermissions(SystemPermissions.READ_ALL_ATTENDANCE)
  @ApiOperation({ summary: 'Monitor en vivo (Director)' })
  async getDailyMonitor(@Query() query: GetMonitorDto, @Req() req: any) {
    return this.attendanceService.getDailyMonitor(query, req.user);
  }

  @Post('manual')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_ATTENDANCE)
  async markManualAttendance(@Body() dto: any, @Req() req: any) {
    return this.attendanceService.markManualAttendance(dto, req.user);
  }

  @Get('history/:enrollmentId')
  @RequirePermissions(SystemPermissions.READ_ALL_ATTENDANCE)
  async getHistory(
    @Param('enrollmentId') enrollmentId: string,
    @Req() req: any,
  ) {
    return this.attendanceService.getStudentAttendanceHistory(
      enrollmentId,
      req.user,
    );
  }

  @Patch('justify/:id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_ATTENDANCE)
  async justify(
    @Param('id') id: string,
    @Body('justification') justification: string,
    @Req() req: any,
  ) {
    return this.attendanceService.justifyAttendance(
      id,
      justification,
      req.user,
    );
  }
}

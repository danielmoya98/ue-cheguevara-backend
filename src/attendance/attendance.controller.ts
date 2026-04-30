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

// 🔥 IMPORTACIONES ABAC
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

  // ==========================================
  // 👨‍🏫 RUTAS DEL DOCENTE
  // ==========================================

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
    @Query('classPeriodId') classPeriodId: string,
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
    return this.attendanceService.saveBulkAttendance(bulkData, req.user);
  }

  // ==========================================
  // 🛡️ RUTAS COMPARTIDAS (DOCENTE Y DIRECTOR)
  // ==========================================

  @Post('scan')
  // 🔥 ABAC: Dejamos entrar al que toma su lista (Docente) o al que maneja todo (Admin)
  @RequirePermissions(
    SystemPermissions.CREATE_OWN_ATTENDANCE,
    SystemPermissions.MANAGE_ALL_ATTENDANCE,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registra asistencia mediante escaneo QR para un bloque',
  })
  async scanQR(@Body() dto: any, @Req() req: any) {
    return this.attendanceService.registerScan(dto, req.user);
  }

  @Get('monitor')
  // 🔥 ABAC: Dejamos entrar al Docente (para ver su curso) y al Admin (para ver todos)
  @RequirePermissions(
    SystemPermissions.CREATE_OWN_ATTENDANCE,
    SystemPermissions.READ_ALL_ATTENDANCE,
  )
  @ApiOperation({ summary: 'Monitor en vivo' })
  async getDailyMonitor(@Query() query: GetMonitorDto, @Req() req: any) {
    return this.attendanceService.getDailyMonitor(query, req.user);
  }

  @Post('manual')
  // 🔥 ABAC: Dejamos entrar al Docente (Plan B) y al Admin (Corrección manual)
  @RequirePermissions(
    SystemPermissions.CREATE_OWN_ATTENDANCE,
    SystemPermissions.MANAGE_ALL_ATTENDANCE,
  )
  @ApiOperation({
    summary: 'Marca o corrige la asistencia manualmente (Plan B)',
  })
  async markManualAttendance(@Body() dto: any, @Req() req: any) {
    return this.attendanceService.markManualAttendance(dto, req.user);
  }

  // ==========================================
  // 🏛️ RUTAS EXCLUSIVAS DEL DIRECTOR
  // ==========================================

  @Get('history/:enrollmentId')
  @RequirePermissions(SystemPermissions.READ_ALL_ATTENDANCE)
  @ApiOperation({
    summary: 'Obtiene historial de faltas/atrasos para justificar',
  })
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
  @ApiOperation({ summary: 'Convierte una falta/atraso en Licencia (EXCUSED)' })
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

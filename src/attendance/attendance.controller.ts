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

// 🔥 IMPORTACIONES RBAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Control de Asistencia')
@ApiCookieAuth('uecg_access_token')
@Controller('attendance')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // Escudo Activado
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ==========================================
  // 👨‍🏫 RUTAS DEL DOCENTE (Nuevas)
  // ==========================================

  @Get('schedule')
  @RequirePermissions(SystemPermissions.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Obtiene el horario del día para tomar asistencia' })
  async getDailySchedule(@Query('date') date: string, @Req() req: any) {
    return this.attendanceService.getDailySchedule(date, req.user);
  }

  @Get('classroom')
  @RequirePermissions(SystemPermissions.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Obtiene alumnos y estado actual de asistencia' })
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
  @RequirePermissions(SystemPermissions.ATTENDANCE_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Guarda la asistencia masiva de un curso' })
  async saveBulkAttendance(@Body() bulkData: any, @Req() req: any) {
    return this.attendanceService.saveBulkAttendance(bulkData, req.user);
  }

  // ==========================================
  // 🛡️ RUTAS DEL DIRECTOR / SECRETARÍA (Intactas)
  // ==========================================

  @Post('scan')
  @RequirePermissions(SystemPermissions.ATTENDANCE_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registra asistencia mediante escaneo QR' })
  async scanQR(@Body() dto: RegisterAttendanceDto, @Req() req: any) {
    return this.attendanceService.registerScan(dto, req.user);
  }

  @Get('monitor')
  @RequirePermissions(SystemPermissions.ATTENDANCE_READ)
  @ApiOperation({
    summary:
      'Obtiene la lista de alumnos de un curso y su estado de asistencia',
  })
  async getDailyMonitor(@Query() query: GetMonitorDto, @Req() req: any) {
    return this.attendanceService.getDailyMonitor(query, req.user);
  }

  @Post('manual')
  @RequirePermissions(SystemPermissions.ATTENDANCE_WRITE)
  @ApiOperation({
    summary: 'Marca o corrige la asistencia manualmente (Plan B)',
  })
  async markManualAttendance(
    @Body() dto: ManualAttendanceDto,
    @Req() req: any,
  ) {
    return this.attendanceService.markManualAttendance(dto, req.user);
  }

  @Get('history/:enrollmentId')
  @RequirePermissions(SystemPermissions.ATTENDANCE_READ)
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
  @RequirePermissions(SystemPermissions.ATTENDANCE_JUSTIFY)
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

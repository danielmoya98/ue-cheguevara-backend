import { Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus, Get, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { RegisterAttendanceDto } from './dto/register-attendance.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../prisma/generated/client';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { GetMonitorDto } from './dto/get-monitor.dto';
import { ManualAttendanceDto } from './dto/manual-attendance.dto';

@ApiTags('Control de Asistencia')
@ApiCookieAuth('uecg_access_token')
@Controller('attendance')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('scan')
  @Roles(Role.DOCENTE, Role.ADMIN, Role.SECRETARIA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registra asistencia mediante escaneo QR' })
  async scanQR(@Body() dto: RegisterAttendanceDto, @Req() req: any) {
    // req.user.userId es el UUID del profesor logueado en la Web/App que está escaneando
    return this.attendanceService.registerScan(dto, req.user.userId);
  }

  @Get('monitor')
  @Roles(Role.ADMIN, Role.SECRETARIA, Role.DOCENTE)
  @ApiOperation({ summary: 'Obtiene la lista de alumnos de un curso y su estado de asistencia' })
  async getDailyMonitor(@Query() query: GetMonitorDto) {
    // 🛡️ REGLA FUTURA: Si req.user.role === 'DOCENTE', aquí llamaremos a un servicio 
    // que verifique si el docente está asignado a ese 'query.classroomId' a esa hora.
    // Como estamos en Modo Admin, todos pasan libremente por ahora.
    
    return this.attendanceService.getDailyMonitor(query);
  }

  @Post('manual')
  @Roles(Role.ADMIN, Role.SECRETARIA, Role.DOCENTE)
  @ApiOperation({ summary: 'Marca o corrige la asistencia manualmente (Plan B)' })
  async markManualAttendance(@Body() dto: ManualAttendanceDto, @Req() req: any) {
    // req.user.userId es el UUID del Admin o Docente que hizo clic en el botón
    return this.attendanceService.markManualAttendance(dto, req.user.userId);
  }
  
}
import { Controller, Post, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { RegisterAttendanceDto } from './dto/register-attendance.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../prisma/generated/client';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

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
}
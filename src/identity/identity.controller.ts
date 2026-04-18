import { Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../prisma/generated/client';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Identidad y Carnetización')
@ApiCookieAuth('uecg_access_token')
@Controller('identity')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get('qr/:studentId')
  @ApiOperation({ summary: 'Obtiene el QR firmado de un alumno en Base64' })
  async getStudentQR(@Param('studentId') studentId: string) {
    const qrBase64 = await this.identityService.generateQRCode(studentId);
    return { qr: qrBase64 };
  }

  // 🔥 NUEVO ENDPOINT
  @Post('generate/:studentId')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Genera y activa un nuevo QR para el estudiante' })
  async generateNewQR(@Param('studentId') studentId: string) {
    return this.identityService.generateNewQR(studentId);
  }

  @Post('revoke/:studentId')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoca el QR actual de un estudiante' })
  async revokeQR(@Param('studentId') studentId: string) {
    return this.identityService.revokeQR(studentId);
  }

  @Post('export/mass/:academicYearId')
  @Roles(Role.ADMIN, Role.SECRETARIA)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Inicia la generación asíncrona de ZIP con carnets' })
  async startMassExport(
    @Param('academicYearId') academicYearId: string,
    @Body() filters: { level?: string; classroomId?: string },
  ) {
    return this.identityService.requestMassiveCarnets(academicYearId, filters);
  }
}
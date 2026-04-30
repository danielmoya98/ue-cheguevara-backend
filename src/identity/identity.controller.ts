import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IdentityService } from './identity.service';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

// 🔥 IMPORTACIONES ABAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Identidad y Carnetización')
@ApiCookieAuth('uecg_access_token')
@Controller('identity')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get('qr/:studentId')
  @RequirePermissions(
    SystemPermissions.READ_ALL_STUDENT,
    SystemPermissions.CREATE_ANY_IDENTITY,
  ) // 🔥 ABAC
  @ApiOperation({ summary: 'Obtiene el estado y el QR del alumno' })
  async getStudentQR(@Param('studentId') studentId: string) {
    return this.identityService.getStudentQR(studentId);
  }

  @Post('generate/:studentId')
  @RequirePermissions(SystemPermissions.CREATE_ANY_IDENTITY) // 🔥 ABAC
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Genera y activa un nuevo QR para el estudiante' })
  async generateNewQR(@Param('studentId') studentId: string) {
    return this.identityService.generateNewQR(studentId);
  }

  @Post('revoke/:studentId')
  @RequirePermissions(SystemPermissions.CREATE_ANY_IDENTITY) // 🔥 ABAC
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoca el QR actual de un estudiante' })
  async revokeQR(@Param('studentId') studentId: string) {
    return this.identityService.revokeQR(studentId);
  }

  @Post('export/mass/:academicYearId')
  @RequirePermissions(SystemPermissions.CREATE_ANY_IDENTITY) // 🔥 ABAC
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Inicia la generación asíncrona de ZIP con carnets',
  })
  async startMassExport(
    @Param('academicYearId') academicYearId: string,
    @Body() filters: { level?: string; classroomId?: string },
  ) {
    return this.identityService.requestMassiveCarnets(academicYearId, filters);
  }
}

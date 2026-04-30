import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { DataUpdatesService } from './data-updates.service';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

// 🔥 IMPORTACIONES ABAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Actualización de Datos RUDE (Cuarentena)')
@Controller('data-updates')
export class DataUpdatesController {
  constructor(private readonly dataUpdatesService: DataUpdatesService) {}

  @Post('broadcast/all')
  @ApiCookieAuth('uecg_access_token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermissions(SystemPermissions.UPDATE_ALL_STUDENT) // 🔥 ABAC (Poder Nuclear)
  @ApiOperation({ summary: 'Envía Push a TODOS los padres del colegio' })
  async triggerMassiveCampaign() {
    return this.dataUpdatesService.broadcastToAll();
  }

  // ========================================================
  // 🌐 ENDPOINTS PÚBLICOS (Sin Login - Para el Padre de Familia)
  // ========================================================

  @Get('public/verify/:token')
  @ApiOperation({
    summary:
      'Verifica el token JWT y devuelve los datos actuales del estudiante',
  })
  verifyPublicToken(@Param('token') token: string) {
    return this.dataUpdatesService.verifyTokenAndGetData(token);
  }

  @Post('public/submit/:token')
  @ApiOperation({
    summary: 'Recibe el formulario del padre y lo pone en cuarentena (PENDING)',
  })
  submitUpdate(@Param('token') token: string, @Body() proposedData: any) {
    return this.dataUpdatesService.submitUpdate(token, proposedData);
  }

  // ========================================================
  // 🔒 ENDPOINTS PRIVADOS (Con Login - Para la Secretaría)
  // ========================================================

  @Get('pending')
  @ApiCookieAuth('uecg_access_token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermissions(SystemPermissions.READ_ALL_STUDENT) // 🔥 ABAC
  @ApiOperation({
    summary: 'Obtiene todas las solicitudes que esperan revisión',
  })
  getPendingRequests() {
    return this.dataUpdatesService.getPendingRequests();
  }

  @Post(':id/approve')
  @ApiCookieAuth('uecg_access_token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermissions(SystemPermissions.UPDATE_ALL_STUDENT) // 🔥 ABAC
  @ApiOperation({ summary: 'Aprueba una solicitud y fusiona los datos' })
  approveUpdate(@Param('id') id: string) {
    return this.dataUpdatesService.approveUpdate(id);
  }

  @Patch(':id/reject')
  @ApiCookieAuth('uecg_access_token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermissions(SystemPermissions.UPDATE_ALL_STUDENT) // 🔥 ABAC
  @ApiOperation({ summary: 'Rechaza una solicitud de actualización' })
  rejectUpdate(@Param('id') id: string, @Body('reason') reason: string) {
    return this.dataUpdatesService.rejectUpdate(
      id,
      reason || 'Datos inconsistentes',
    );
  }

  @Patch(':enrollmentId/mark-physical')
  @ApiCookieAuth('uecg_access_token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermissions(SystemPermissions.UPDATE_ALL_STUDENT) // 🔥 ABAC
  @ApiOperation({ summary: 'Registra que el padre entregó el RUDE en papel' })
  markPhysicalDelivery(@Param('enrollmentId') enrollmentId: string) {
    return this.dataUpdatesService.markPhysicalDelivery(enrollmentId);
  }

  @Post('generate-link/:enrollmentId')
  @ApiCookieAuth('uecg_access_token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermissions(SystemPermissions.UPDATE_ALL_STUDENT) // 🔥 ABAC
  @ApiOperation({ summary: 'Genera el enlace seguro JWT para WhatsApp/Email' })
  async generateUpdateLink(@Param('enrollmentId') enrollmentId: string) {
    const token =
      await this.dataUpdatesService.generateUpdateToken(enrollmentId);
    const publicUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return { token, url: `${publicUrl}/actualizar-datos/${token}` };
  }

  @Post('broadcast/:enrollmentId')
  @ApiCookieAuth('uecg_access_token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermissions(SystemPermissions.UPDATE_ALL_STUDENT) // 🔥 ABAC
  @ApiOperation({ summary: 'Envía Push individual a tutores' })
  async triggerPushCampaign(@Param('enrollmentId') enrollmentId: string) {
    return this.dataUpdatesService.broadcastUpdateCampaign(enrollmentId);
  }

  @Post('broadcast/classroom/:classroomId')
  @ApiCookieAuth('uecg_access_token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermissions(SystemPermissions.UPDATE_ALL_STUDENT) // 🔥 ABAC
  @ApiOperation({ summary: 'Envía Push a todos los padres de un curso' })
  async triggerClassroomCampaign(@Param('classroomId') classroomId: string) {
    return this.dataUpdatesService.broadcastToClassroom(classroomId);
  }

  @Get('broadcast/classroom/:classroomId/preview')
  @ApiCookieAuth('uecg_access_token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermissions(SystemPermissions.READ_ALL_STUDENT) // 🔥 ABAC
  @ApiOperation({
    summary: 'Simula a cuántos padres llegará la alerta por curso',
  })
  async previewClassroomCampaign(@Param('classroomId') classroomId: string) {
    return this.dataUpdatesService.previewClassroomBroadcast(classroomId);
  }
}

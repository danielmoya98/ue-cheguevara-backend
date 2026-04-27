import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { GradesService } from './grades.service';
import { UpsertGradeDto } from './dto/upsert-grade.dto';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ResolveChangeRequestDto } from './dto/resolve-change-request.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

// 🔥 IMPORTACIONES RBAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Calificaciones (Libreta Escolar)')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Put()
  @RequirePermissions(SystemPermissions.GRADES_WRITE) // 🔥 RBAC
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingresa o actualiza la nota de un estudiante' })
  upsertGrade(@Body() upsertGradeDto: UpsertGradeDto, @Req() req: any) {
    return this.gradesService.upsertGrade(upsertGradeDto, req.user);
  }

  @Get('assignment/:assignmentId/trimester/:trimesterId')
  @RequirePermissions(SystemPermissions.GRADES_READ) // 🔥 RBAC
  @ApiOperation({
    summary: 'Obtiene la planilla de notas de un curso para una materia',
  })
  getGradesByAssignment(
    @Param('assignmentId') assignmentId: string,
    @Param('trimesterId') trimesterId: string,
    @Req() req: any,
  ) {
    return this.gradesService.getGradesByAssignment(
      assignmentId,
      trimesterId,
      req.user,
    );
  }

  // ==========================================
  // RUTAS DE DESCONGELAMIENTO (CHANGE REQUESTS)
  // ==========================================

  @Post('change-requests')
  @RequirePermissions(SystemPermissions.GRADES_WRITE)
  @ApiOperation({
    summary: 'Profesor solicita corrección de nota en trimestre cerrado',
  })
  createChangeRequest(@Body() dto: CreateChangeRequestDto, @Req() req: any) {
    return this.gradesService.createChangeRequest(dto, req.user);
  }

  @Get('change-requests/pending')
  @RequirePermissions(SystemPermissions.GRADES_WRITE) // Para el Director
  @ApiOperation({
    summary: 'Director lista solicitudes pendientes de corrección',
  })
  getPendingRequests() {
    return this.gradesService.getPendingRequests();
  }

  @Patch('change-requests/:id/resolve')
  @RequirePermissions(SystemPermissions.GRADES_WRITE) // Para el Director
  @ApiOperation({
    summary: 'Director aprueba o rechaza solicitud de corrección',
  })
  resolveChangeRequest(
    @Param('id') id: string,
    @Body() dto: ResolveChangeRequestDto,
    @Req() req: any,
  ) {
    return this.gradesService.resolveChangeRequest(id, dto, req.user);
  }
}

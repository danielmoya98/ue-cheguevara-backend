import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { GradesService } from './grades.service';
import { UpsertGradeDto } from './dto/upsert-grade.dto';
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
    // Pasamos el objeto usuario completo para ejecutar políticas ABAC
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
    // Pasamos el objeto usuario completo para ejecutar políticas ABAC
    return this.gradesService.getGradesByAssignment(
      assignmentId,
      trimesterId,
      req.user,
    );
  }
}

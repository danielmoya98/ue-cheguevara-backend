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
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../prisma/generated/client';

@ApiTags('Calificaciones (Libreta Escolar)')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Put()
  @Roles(Role.ADMIN, Role.DOCENTE) // Director y Docente pueden calificar
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingresa o actualiza la nota de un estudiante' })
  upsertGrade(@Body() upsertGradeDto: UpsertGradeDto, @Req() req: any) {
    // Obtenemos el ID del usuario logueado para la auditoría
    const userId = req.user.id;
    return this.gradesService.upsertGrade(upsertGradeDto, userId);
  }

  @Get('assignment/:assignmentId/trimester/:trimesterId')
  @Roles(Role.ADMIN, Role.DOCENTE)
  @ApiOperation({
    summary: 'Obtiene la planilla de notas de un curso para una materia',
  })
  getGradesByAssignment(
    @Param('assignmentId') assignmentId: string,
    @Param('trimesterId') trimesterId: string,
  ) {
    return this.gradesService.getGradesByAssignment(assignmentId, trimesterId);
  }
}

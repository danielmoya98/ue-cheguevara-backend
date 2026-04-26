import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TrimestersService } from './trimesters.service';
import { UpdateTrimesterDto } from './dto/update-trimester.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

// 🔥 IMPORTACIONES RBAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Configuración de Trimestres')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
@Controller('trimesters')
export class TrimestersController {
  constructor(private readonly trimestersService: TrimestersService) {}

  @Get('year/:academicYearId')
  // 🔓 Lectura abierta a todo usuario logueado (Los profesores necesitan saber si está abierto)
  @ApiOperation({ summary: 'Obtiene los trimestres de una gestión específica' })
  getByAcademicYear(@Param('academicYearId') academicYearId: string) {
    return this.trimestersService.getByAcademicYear(academicYearId);
  }

  @Patch(':id')
  @RequirePermissions(SystemPermissions.TRIMESTERS_WRITE) // 🔥 Solo Admin/Director
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza fechas o abre/cierra un trimestre' })
  update(
    @Param('id') id: string,
    @Body() updateTrimesterDto: UpdateTrimesterDto,
  ) {
    return this.trimestersService.update(id, updateTrimesterDto);
  }
}

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
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../prisma/generated/client';

@ApiTags('Configuración de Trimestres')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('trimesters')
export class TrimestersController {
  constructor(private readonly trimestersService: TrimestersService) {}

  @Get('year/:academicYearId')
  @ApiOperation({ summary: 'Obtiene los trimestres de una gestión específica' })
  getByAcademicYear(@Param('academicYearId') academicYearId: string) {
    return this.trimestersService.getByAcademicYear(academicYearId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN) // Solo el Director puede tocar fechas y abrir/cerrar trimestres
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualiza fechas o abre/cierra un trimestre' })
  update(
    @Param('id') id: string,
    @Body() updateTrimesterDto: UpdateTrimesterDto,
  ) {
    return this.trimestersService.update(id, updateTrimesterDto);
  }
}

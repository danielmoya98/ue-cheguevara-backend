import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ClassPeriodsService } from './class-periods.service';
import { CreateClassPeriodDto } from './dto/create-class-period.dto';
import { UpdateClassPeriodDto } from './dto/update-class-period.dto';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Shift } from '../../prisma/generated/client';

// 🔥 IMPORTACIONES ABAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Periodos de Clase (Campanario)')
@ApiCookieAuth('uecg_access_token')
@Controller('class-periods')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo de Seguridad Activado
export class ClassPeriodsController {
  constructor(private readonly classPeriodsService: ClassPeriodsService) {}

  @Post()
  @RequirePermissions(SystemPermissions.MANAGE_ALL_TIMETABLE) // 🔥 ABAC: Solo el Director (Arquitecto)
  @ApiOperation({ summary: 'Crea un nuevo bloque de hora o recreo' })
  async create(@Body() createClassPeriodDto: CreateClassPeriodDto) {
    const data = await this.classPeriodsService.create(createClassPeriodDto);
    return { data, message: 'Periodo creado exitosamente' };
  }

  @Get()
  // 🔓 ABAC: Sin @RequirePermissions. Cualquier usuario logueado (Docentes/Director)
  // necesita leer las horas para saber su horario y tomar asistencia.
  @ApiOperation({ summary: 'Obtiene la lista de horas de clase' })
  @ApiQuery({ name: 'shift', enum: Shift, required: false })
  async findAll(@Query('shift') shift?: Shift) {
    const data = await this.classPeriodsService.findAll(shift);
    return { data };
  }

  @Patch(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_TIMETABLE) // 🔥 ABAC
  @ApiOperation({ summary: 'Actualiza una hora específica' })
  async update(
    @Param('id') id: string,
    @Body() updateClassPeriodDto: UpdateClassPeriodDto,
  ) {
    const data = await this.classPeriodsService.update(
      id,
      updateClassPeriodDto,
    );
    return { data, message: 'Periodo actualizado' };
  }

  @Delete(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_TIMETABLE) // 🔥 ABAC
  @ApiOperation({ summary: 'Elimina un periodo (Solo si no está en uso)' })
  async remove(@Param('id') id: string) {
    return this.classPeriodsService.remove(id);
  }
}

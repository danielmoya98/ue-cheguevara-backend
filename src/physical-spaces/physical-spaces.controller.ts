import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PhysicalSpacesService } from './physical-spaces.service';
import { CreatePhysicalSpaceDto } from './dto/create-physical-space.dto';
import { UpdatePhysicalSpaceDto } from './dto/update-physical-space.dto';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { SpaceType } from '../../prisma/generated/client';

// 🔥 IMPORTACIONES ABAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Gestión de Espacios Físicos')
@ApiCookieAuth('uecg_access_token') // 🔥 Requerido para Swagger
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Candados Maestros Activados
@Controller('physical-spaces')
export class PhysicalSpacesController {
  constructor(private readonly physicalSpacesService: PhysicalSpacesService) {}

  @Post()
  @RequirePermissions(SystemPermissions.MANAGE_ALL_PHYSICAL_SPACE) // 🔥 ABAC: Solo personal autorizado
  @ApiOperation({ summary: 'Registra una nueva aula, laboratorio o cancha' })
  create(@Body() createPhysicalSpaceDto: CreatePhysicalSpaceDto) {
    return this.physicalSpacesService.create(createPhysicalSpaceDto);
  }

  @Get()
  // 🔓 Sin @RequirePermissions: Lectura abierta para cualquier usuario logueado.
  // Los docentes necesitan ver las aulas para saber dónde dictar clases.
  @ApiOperation({ summary: 'Obtiene todos los espacios físicos' })
  @ApiQuery({ name: 'type', required: false, enum: SpaceType })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(
    @Query('type') type?: SpaceType,
    @Query('isActive') isActiveStr?: string,
  ) {
    let isActive: boolean | undefined = undefined;
    if (isActiveStr === 'true') isActive = true;
    if (isActiveStr === 'false') isActive = false;

    return this.physicalSpacesService.findAll(type, isActive);
  }

  @Get(':id')
  // 🔓 Sin @RequirePermissions: Lectura abierta
  @ApiOperation({ summary: 'Obtiene el detalle de un espacio físico' })
  findOne(@Param('id') id: string) {
    return this.physicalSpacesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_PHYSICAL_SPACE) // 🔥 ABAC
  @ApiOperation({ summary: 'Actualiza nombre, capacidad o estado' })
  update(
    @Param('id') id: string,
    @Body() updatePhysicalSpaceDto: UpdatePhysicalSpaceDto,
  ) {
    return this.physicalSpacesService.update(id, updatePhysicalSpaceDto);
  }

  @Delete(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_PHYSICAL_SPACE) // 🔥 ABAC
  @ApiOperation({ summary: 'Elimina un espacio físico (Si no está en uso)' })
  remove(@Param('id') id: string) {
    return this.physicalSpacesService.remove(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { PhysicalSpacesService } from './physical-spaces.service';
import { CreatePhysicalSpaceDto } from './dto/create-physical-space.dto';
import { UpdatePhysicalSpaceDto } from './dto/update-physical-space.dto';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SpaceType } from '../../prisma/generated/client';

@ApiTags('Gestión de Espacios Físicos')
@Controller('physical-spaces')
export class PhysicalSpacesController {
  constructor(private readonly physicalSpacesService: PhysicalSpacesService) {}

  @Post()
  @ApiOperation({ summary: 'Registra una nueva aula, laboratorio o cancha' })
  create(@Body() createPhysicalSpaceDto: CreatePhysicalSpaceDto) {
    return this.physicalSpacesService.create(createPhysicalSpaceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtiene todos los espacios físicos' })
  @ApiQuery({ name: 'type', required: false, enum: SpaceType })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(
    @Query('type') type?: SpaceType,
    @Query('isActive') isActiveStr?: string,
  ) {
    // Convertimos el string 'true'/'false' de la URL a un boolean real
    let isActive: boolean | undefined = undefined;
    if (isActiveStr === 'true') isActive = true;
    if (isActiveStr === 'false') isActive = false;

    return this.physicalSpacesService.findAll(type, isActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene el detalle de un espacio físico' })
  findOne(@Param('id') id: string) {
    return this.physicalSpacesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza nombre, capacidad o estado' })
  update(
    @Param('id') id: string,
    @Body() updatePhysicalSpaceDto: UpdatePhysicalSpaceDto,
  ) {
    return this.physicalSpacesService.update(id, updatePhysicalSpaceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina un espacio físico (Si no está en uso)' })
  remove(@Param('id') id: string) {
    return this.physicalSpacesService.remove(id);
  }
}

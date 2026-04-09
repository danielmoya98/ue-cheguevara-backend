import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors, // <-- 1. Importado
} from '@nestjs/common';
import { InstitutionsService } from './institutions.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../src/auth/decorators/roles.decorator';
import { Role } from '../../prisma/generated/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager'; // <-- 2. Herramientas de caché

@ApiTags('Institución (RUE)')
@ApiCookieAuth('uecg_access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Registra una nueva unidad educativa' })
  create(@Body() createInstitutionDto: CreateInstitutionDto, @Req() req: any) {
    createInstitutionDto.directorId = req.user.userId;
    return this.institutionsService.create(createInstitutionDto);
  }

  // ==========================================
  // LECTURAS CACHEADAS (ALTO RENDIMIENTO)
  // ==========================================

  @Get()
  @UseInterceptors(CacheInterceptor) // <-- Activa Redis
  @CacheTTL(300000) // <-- Cacheado por 5 minutos (300,000 ms)
  @ApiOperation({
    summary: 'Obtiene instituciones con paginación, filtros y ordenamiento',
  })
  findAll(@Query() query: PaginationDto) {
    return this.institutionsService.findAll(query);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor) // <-- Activa Redis
  @CacheTTL(300000) // <-- Cacheado por 5 minutos
  @ApiOperation({ summary: 'Obtiene una institución por su ID' })
  findOne(@Param('id') id: string) {
    return this.institutionsService.findOne(id);
  }

  // ==========================================

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualiza los datos del RUE (Idempotente)' })
  update(
    @Param('id') id: string,
    @Body() updateInstitutionDto: UpdateInstitutionDto,
    @Req() req: any,
  ) {
    updateInstitutionDto.directorId = req.user.userId;
    return this.institutionsService.update(id, updateInstitutionDto);
  }
}

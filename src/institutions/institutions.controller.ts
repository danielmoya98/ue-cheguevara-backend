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
  UseInterceptors,
  Inject,
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
import {
  CacheInterceptor,
  CacheTTL,
  CACHE_MANAGER,
} from '@nestjs/cache-manager';

// Mantenemos el import type que le gusta a TypeScript
import type { Cache } from 'cache-manager';
import { UpdateCampaignSettingsDto } from './dto/update-campaign-settings.dto';

@ApiTags('Institución (RUE)')
@ApiCookieAuth('uecg_access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('institutions')
export class InstitutionsController {
  constructor(
    private readonly institutionsService: InstitutionsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get('campaign-settings')
  @ApiOperation({ summary: 'Obtiene el estado actual de la campaña RUDE' })
  // No le ponemos CacheInterceptor para que la Directora vea el estado real al instante
  getCampaignSettings() {
    return this.institutionsService.getCampaignSettings();
  }

  @Patch('campaign-settings')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualiza la configuración de la campaña RUDE' })
  async updateCampaignSettings(
    @Body() body: UpdateCampaignSettingsDto, // 🔥 AQUÍ ESTÁ LA MAGIA
  ) {
    const result = await this.institutionsService.updateCampaignSettings(body);

    await this.cacheManager.clear();

    return result;
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Registra una nueva unidad educativa' })
  async create(
    @Body() createInstitutionDto: CreateInstitutionDto,
    @Req() req: any,
  ) {
    createInstitutionDto.directorId = req.user.userId;
    const result = await this.institutionsService.create(createInstitutionDto);

    // 🔥 CORRECCIÓN: Usamos el método oficial .clear() de la v5+
    await this.cacheManager.clear();
    return result;
  }

  // ==========================================
  // LECTURAS CACHEADAS (ALTO RENDIMIENTO)
  // ==========================================

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @ApiOperation({
    summary: 'Obtiene instituciones con paginación, filtros y ordenamiento',
  })
  findAll(@Query() query: PaginationDto) {
    return this.institutionsService.findAll(query);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @ApiOperation({ summary: 'Obtiene una institución por su ID' })
  findOne(@Param('id') id: string) {
    return this.institutionsService.findOne(id);
  }

  // ==========================================

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualiza los datos del RUE (Idempotente)' })
  async update(
    @Param('id') id: string,
    @Body() updateInstitutionDto: UpdateInstitutionDto,
    @Req() req: any,
  ) {
    updateInstitutionDto.directorId = req.user.userId;
    const result = await this.institutionsService.update(
      id,
      updateInstitutionDto,
    );

    // 🔥 CORRECCIÓN: Usamos el método oficial .clear() de la v5+
    await this.cacheManager.clear();
    return result;
  }
}

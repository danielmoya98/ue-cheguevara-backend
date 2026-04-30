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
import { UpdateCampaignSettingsDto } from './dto/update-campaign-settings.dto';
import { UpdateAttendanceSettingsDto } from './dto/update-attendance-settings.dto';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CacheInterceptor,
  CacheTTL,
  CACHE_MANAGER,
} from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

// 🔥 IMPORTACIONES ABAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@ApiTags('Institución (RUE)')
@ApiCookieAuth('uecg_access_token')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
@Controller('institutions')
export class InstitutionsController {
  constructor(
    private readonly institutionsService: InstitutionsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ==========================================
  // 🔥 1. RUTAS ESTÁTICAS (SIEMPRE VAN PRIMERO)
  // ==========================================

  // --- PANEL DE CAMPAÑA RUDE ---
  @Get('campaign-settings')
  // 🔓 Lectura abierta para que el Frontend sepa si la campaña está activa
  @ApiOperation({ summary: 'Obtiene el estado actual de la campaña RUDE' })
  getCampaignSettings() {
    return this.institutionsService.getCampaignSettings();
  }

  @Patch('campaign-settings')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_INSTITUTION) // 🔥 ABAC
  @ApiOperation({ summary: 'Actualiza la configuración de la campaña RUDE' })
  async updateCampaignSettings(@Body() body: UpdateCampaignSettingsDto) {
    const result = await this.institutionsService.updateCampaignSettings(body);
    await this.cacheManager.clear();
    return result;
  }

  // --- REGLAS DE ASISTENCIA ---
  @Get('attendance-settings')
  // 🔓 Lectura abierta (Profesores necesitan saber las tolerancias)
  @ApiOperation({ summary: 'Obtiene las reglas de asistencia' })
  getAttendanceSettings() {
    return this.institutionsService.getAttendanceSettings();
  }

  @Patch('attendance-settings')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_INSTITUTION) // 🔥 ABAC
  @ApiOperation({ summary: 'Actualiza las reglas de asistencia' })
  async updateAttendanceSettings(@Body() body: UpdateAttendanceSettingsDto) {
    const result =
      await this.institutionsService.updateAttendanceSettings(body);
    await this.cacheManager.clear();
    return result;
  }

  // ==========================================
  // 📦 2. RUTAS DINÁMICAS Y CRUD (VAN AL FINAL)
  // ==========================================

  @Post()
  @RequirePermissions(SystemPermissions.MANAGE_ALL_INSTITUTION) // 🔥 ABAC
  @ApiOperation({ summary: 'Registra una nueva unidad educativa' })
  async create(
    @Body() createInstitutionDto: CreateInstitutionDto,
    @Req() req: any,
  ) {
    createInstitutionDto.directorId = req.user.userId;
    const result = await this.institutionsService.create(createInstitutionDto);
    await this.cacheManager.clear();
    return result;
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000) // 5 minutos de caché
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

  @Patch(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL_INSTITUTION) // 🔥 ABAC
  @ApiOperation({ summary: 'Actualiza los datos del RUE' })
  async update(
    @Param('id') id: string,
    @Body() updateInstitutionDto: UpdateInstitutionDto,
    @Req() req: any,
  ) {
    // Si cambia el director, registramos quién hizo el cambio/es el nuevo director
    if (req.user.userId) {
      updateInstitutionDto.directorId = req.user.userId;
    }
    const result = await this.institutionsService.update(
      id,
      updateInstitutionDto,
    );
    await this.cacheManager.clear();
    return result;
  }
}

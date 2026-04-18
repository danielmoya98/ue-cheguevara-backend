import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ClassPeriodsService } from './class-periods.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('Periodos de Clase')
@ApiCookieAuth('uecg_access_token')
@Controller('class-periods')
@UseGuards(AuthGuard('jwt'))
export class ClassPeriodsController {
  constructor(private readonly classPeriodsService: ClassPeriodsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene la lista de horas de clase' })
  async findAll() {
    const data = await this.classPeriodsService.findAll();
    return { data }; // Envolvemos en { data } para que el frontend lo lea correctamente
  }

  @Post('seed')
  @ApiOperation({ summary: 'Genera las horas de clase por defecto (Solo usar 1 vez)' })
  async seed() {
    return this.classPeriodsService.seedDefaultPeriods();
  }
}
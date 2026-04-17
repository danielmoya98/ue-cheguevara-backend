import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health Check')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Verifica que la API esté funcionando (Para Render)' })
  healthCheck() {
    return { status: 'UP', message: 'API U.E.C.G. funcionando correctamente' };
  }
}
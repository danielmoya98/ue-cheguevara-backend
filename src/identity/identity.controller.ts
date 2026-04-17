import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Identidad y Carnetización')
@Controller('identity')
@UseGuards(AuthGuard('jwt'))
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get('qr/:studentId')
  @ApiOperation({ summary: 'Obtiene el QR firmado de un alumno en Base64' })
  async getStudentQR(@Param('studentId') studentId: string) {
    const qrBase64 = await this.identityService.generateQRCode(studentId);
    return { qr: qrBase64 };
  }
}

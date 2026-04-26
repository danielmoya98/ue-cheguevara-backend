import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Param,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentsService } from './students.service';
import { CreateFullRudeDto } from './dto/create-student.dto';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

// 🔥 IMPORTACIONES RBAC
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Inscripciones y RUDE')
@Controller('students')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 🔥 Escudo Activado
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register-rude')
  @RequirePermissions(SystemPermissions.STUDENTS_WRITE) // 🔥 Solo Admin/Secretaría
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Registra a un estudiante, sus tutores y su RUDE en una sola transacción',
  })
  createFullRude(@Body() createDto: CreateFullRudeDto) {
    return this.studentsService.registerFullRude(createDto);
  }

  @Post('import-excel/:academicYearId')
  @RequirePermissions(SystemPermissions.STUDENTS_WRITE) // 🔥 Solo Admin/Secretaría
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Importa estudiantes masivamente a un curso específico',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        status: { type: 'string', description: 'INSCRITO o REVISION_SIE' },
        classroomId: { type: 'string', description: 'UUID del curso destino' },
      },
    },
  })
  importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Param('academicYearId') academicYearId: string,
    @Body('status') globalStatus: string,
    @Body('classroomId') classroomId: string,
  ) {
    return this.studentsService.importStudentsFromExcel(
      file,
      academicYearId,
      globalStatus,
      classroomId,
    );
  }

  // 🔥 RUTA DE APP MÓVIL: Sin RequirePermissions. Pasa si tiene JWT válido.
  @Patch('fcm-token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Registra el dispositivo móvil para notificaciones Push',
  })
  async updateFcmToken(@Req() req: any, @Body('token') fcmToken: string) {
    // 🔥 BUG CORREGIDO: Usamos userId en lugar de sub
    const userId = req.user.userId;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { status: 'ERROR', message: 'Usuario no encontrado' };

    // Usamos Set para no guardar tokens duplicados si el padre desinstala e instala la app
    const tokens = new Set(user.fcmTokens || []);
    tokens.add(fcmToken);

    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmTokens: Array.from(tokens) },
    });

    return {
      status: 'SUCCESS',
      message: 'Dispositivo vinculado correctamente',
    };
  }
}

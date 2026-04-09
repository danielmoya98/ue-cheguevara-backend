import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentsService } from './students.service';
import { CreateFullRudeDto } from './dto/create-student.dto';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('Inscripciones y RUDE')
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post('register-rude')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Registra a un estudiante, sus tutores y su RUDE en una sola transacción',
  })
  createFullRude(@Body() createDto: CreateFullRudeDto) {
    return this.studentsService.registerFullRude(createDto);
  }

  @Post('import-excel/:academicYearId')
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
    @Body('classroomId') classroomId: string, // <-- RECIBIMOS EL CURSO DESDE LA WEB
  ) {
    return this.studentsService.importStudentsFromExcel(
      file,
      academicYearId,
      globalStatus,
      classroomId,
    );
  }
}

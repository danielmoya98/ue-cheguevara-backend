import { PartialType } from '@nestjs/swagger';
// 1. Importamos la clase con el nombre correcto que creamos
import { CreateFullRudeDto } from './create-student.dto';

// 2. Extendemos de esa clase
export class UpdateStudentDto extends PartialType(CreateFullRudeDto) {}

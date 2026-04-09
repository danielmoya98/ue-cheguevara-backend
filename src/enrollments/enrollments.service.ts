import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { Prisma } from '../../prisma/generated/client';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  // 🔥 TRANSACCIÓN MAESTRA DE INSCRIPCIÓN (Ventanilla y Formulario Público)
  async create(createEnrollmentDto: any) {
    // Nota: Usamos 'any' asumiendo que tu CreateEnrollmentDto mapea los campos de Zod.
    // Si tienes el DTO tipado con los 40 campos, el comportamiento es el mismo.
    const payload = createEnrollmentDto;

    return await this.prisma.$transaction(async (tx) => {
      // =========================================================
      // 1. VALIDACIÓN DE CUPOS (LA REGLA DEL RECHAZO)
      // =========================================================
      const occupiedSeats = await tx.enrollment.count({
        where: {
          classroomId: payload.classroomId,
          // 🔥 EL SECRETO DE LOS CUPOS:
          // Solo contamos a los que están esperando revisión o ya inscritos.
          // Los que están RECHAZADOS o RETIRADOS liberan el cupo automáticamente.
          status: { in: ['INSCRITO', 'REVISION_SIE'] },
        },
      });

      const classroom = await tx.classroom.findUnique({
        where: { id: payload.classroomId },
      });

      if (!classroom) {
        throw new NotFoundException('El curso seleccionado no existe.');
      }

      if (occupiedSeats >= classroom.capacity) {
        throw new BadRequestException(
          'El curso seleccionado ya no tiene cupos disponibles.',
        );
      }

      // =========================================================
      // 2. SINCRONIZACIÓN DEL ESTUDIANTE (Student)
      // =========================================================
      let student;
      if (payload.ci) {
        // Si tiene CI, buscamos si ya existe para actualizarlo o crearlo (Upsert)
        student = await tx.student.upsert({
          where: { ci: payload.ci },
          update: {
            // Actualizamos datos volátiles de salud/socioeconómicos
            hasDisability: payload.hasDisability,
            hasAutism: payload.hasAutism,
            // ...
          },
          create: {
            ci: payload.ci,
            documentType: payload.documentType,
            names: payload.names,
            lastNamePaterno: payload.lastNamePaterno,
            lastNameMaterno: payload.lastNameMaterno,
            gender: payload.gender,
            birthDate: new Date(payload.birthDate),
            birthCountry: payload.birthCountry,
            rudeCode: payload.rudeCode || null,
          },
        });
      } else {
        // Si no tiene CI (ej. niños de inicial), lo creamos directo
        student = await tx.student.create({
          data: {
            documentType: payload.documentType,
            names: payload.names,
            lastNamePaterno: payload.lastNamePaterno,
            lastNameMaterno: payload.lastNameMaterno,
            gender: payload.gender,
            birthDate: new Date(payload.birthDate),
            birthCountry: payload.birthCountry,
            rudeCode: payload.rudeCode || null,
          },
        });
      }

      // =========================================================
      // 3. SINCRONIZACIÓN DE TUTORES Y PARENTESCO (StudentGuardian)
      // =========================================================
      if (payload.guardians && payload.guardians.length > 0) {
        for (const tutor of payload.guardians) {
          const guardian = await tx.guardian.upsert({
            where: { ci: tutor.ci },
            update: {
              phone: tutor.phone,
              occupation: tutor.occupation,
              educationLevel: tutor.educationLevel,
            },
            create: {
              ci: tutor.ci,
              names: tutor.names,
              lastNamePaterno: tutor.lastNamePaterno,
              lastNameMaterno: tutor.lastNameMaterno,
              phone: tutor.phone,
              occupation: tutor.occupation,
              educationLevel: tutor.educationLevel,
            },
          });

          // Creamos/Actualizamos el vínculo familiar en la tabla pivote
          await tx.studentGuardian.upsert({
            where: {
              studentId_guardianId: {
                studentId: student.id,
                guardianId: guardian.id,
              },
            },
            update: { relationship: tutor.relationship },
            create: {
              studentId: student.id,
              guardianId: guardian.id,
              relationship: tutor.relationship,
            },
          });
        }
      }

      // =========================================================
      // 4. CREACIÓN DEL EVENTO ANUAL (Enrollment)
      // =========================================================
      // Obtenemos la gestión activa para inyectarla silenciosamente
      const activeYear = await tx.academicYear.findFirst({
        where: { status: 'ACTIVE' },
      });

      if (!activeYear) {
        throw new BadRequestException('No hay una Gestión Académica activa.');
      }

      const enrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          classroomId: payload.classroomId,
          academicYearId: activeYear.id,
          enrollmentType: payload.enrollmentType,
          status: 'REVISION_SIE', // Todo inscrito entra a revisión por defecto
        },
      });

      // =========================================================
      // 5. VOLCADO DEL FORMULARIO SOCIOECONÓMICO (RudeRecord)
      // =========================================================
      await tx.rudeRecord.create({
        data: {
          enrollmentId: enrollment.id,
          // Dirección
          department: payload.department,
          province: payload.province,
          municipality: payload.municipality,
          street: payload.street,
          cellphone: payload.cellphone,
          // Idiomas
          nativeLanguage: payload.nativeLanguage,
          // Transporte
          transportType: payload.transportType,
          transportTime: payload.transportTime,
          livesWith: payload.livesWith,
          // ... (Aquí puedes volcar el resto de los campos de tu DTO)
        },
      });

      return enrollment;
    });
  }

  // 🔥 Nuestro Buscador y Paginador Inteligente
  async findAll(query: QueryEnrollmentDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const {
      search,
      academicYearId,
      classroomId,
      status,
      enrollmentType,
      level,
    } = query;

    // 🔥 1. PROCESAR EL FILTRO DE ESTADO MÚLTIPLE
    let statusFilter: any = undefined;
    if (status) {
      const statusArray = status.split(',');
      statusFilter = { in: statusArray };
    }

    // 🔥 2. PROCESAR PRIORIDAD: CURSO VS NIVEL
    let classroomFilter: any = undefined;
    if (classroomId) {
      // Si enviaron el ID del curso, filtramos exactamente por ese curso
      classroomFilter = { id: classroomId };
    } else if (level) {
      // Si no hay curso pero hay nivel, traemos TODOS los cursos de ese nivel
      classroomFilter = { level: level };
    }

    const whereCondition: Prisma.EnrollmentWhereInput = {
      ...(academicYearId && { academicYearId }),
      ...(statusFilter && { status: statusFilter }), // Usamos el array de estados
      ...(enrollmentType && { enrollmentType }),

      // Aplicamos el filtro relacional que armamos arriba
      ...(classroomFilter && { classroom: classroomFilter }),

      // Búsqueda inteligente dentro de los datos del Estudiante (Intacto)
      ...(search && {
        student: {
          OR: [
            { names: { contains: search, mode: 'insensitive' } },
            { lastNamePaterno: { contains: search, mode: 'insensitive' } },
            { lastNameMaterno: { contains: search, mode: 'insensitive' } },
            { ci: { contains: search, mode: 'insensitive' } },
            { rudeCode: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    // Ejecutamos el conteo y la búsqueda en paralelo (Intacto)
    const [total, data] = await Promise.all([
      this.prisma.enrollment.count({ where: whereCondition }),
      this.prisma.enrollment.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { date: 'desc' }, // Los inscritos más recientes primero
        include: {
          student: {
            select: {
              id: true,
              ci: true,
              rudeCode: true,
              names: true,
              lastNamePaterno: true,
              lastNameMaterno: true,
              gender: true,
            },
          },
          classroom: {
            select: {
              level: true,
              grade: true,
              section: true,
              shift: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // (Intacto)
  async findOne(id: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        academicYear: true,
        classroom: true,
        rudeRecord: true,
        student: {
          include: {
            guardians: {
              include: {
                guardian: true,
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `La inscripción con ID ${id} no fue encontrada en el sistema.`,
      );
    }

    return { data: enrollment };
  }

  // (Intacto y Seguro)
  async update(id: string, updateEnrollmentDto: UpdateEnrollmentDto) {
    const { status, rudeCode, ...restData } = updateEnrollmentDto;

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!enrollment) {
      throw new NotFoundException(`La inscripción con ID ${id} no existe.`);
    }

    if (status === 'INSCRITO') {
      if (
        enrollment.enrollmentType === 'NUEVO' ||
        enrollment.enrollmentType === 'TRASPASO'
      ) {
        if (!rudeCode && !enrollment.student.rudeCode) {
          throw new BadRequestException(
            `Operación denegada: No se puede finalizar la inscripción de un estudiante ${enrollment.enrollmentType} sin registrar su Código RUDE oficial.`,
          );
        }
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedEnrollment = await tx.enrollment.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...restData,
        },
        include: {
          student: true,
          classroom: true,
        },
      });

      if (rudeCode) {
        await tx.student.update({
          where: { id: enrollment.studentId },
          data: { rudeCode },
        });
        updatedEnrollment.student.rudeCode = rudeCode;
      }

      return updatedEnrollment;
    });
  }

  remove(id: string) {
    return `This action removes a #${id} enrollment`;
  }

  // 🔥 NUEVO MÉTODO: Resumen Ligero para el Modal de Kardex
  async findKardex(id: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        enrollmentType: true, // 🔥 AGREGADO: Para ver si es NUEVO, ANTIGUO o TRASPASO
        academicYear: {
          select: { year: true },
        },
        classroom: {
          select: { grade: true, section: true, level: true, shift: true },
        },
        rudeRecord: {
          select: { street: true, houseNumber: true, zone: true },
        },
        student: {
          select: {
            id: true,
            ci: true,
            expedition: true,
            rudeCode: true,
            names: true,
            lastNamePaterno: true,
            lastNameMaterno: true,
            gender: true,
            birthDate: true,
            guardians: {
              include: {
                guardian: {
                  select: {
                    ci: true,
                    names: true,
                    lastNamePaterno: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `El Kardex de la inscripción ${id} no fue encontrado.`,
      );
    }

    return { data: enrollment };
  }
}

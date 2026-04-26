import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { Prisma } from '../../prisma/generated/client';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // HELPER: ABAC - FILTRO DE CURSOS PARA DOCENTES
  // ==========================================
  private async getTeacherClassroomIds(userId: string): Promise<string[]> {
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { teacherId: userId },
      select: { classroomId: true },
    });
    return assignments.map((a) => a.classroomId);
  }

  async create(createEnrollmentDto: any) {
    const payload = createEnrollmentDto;

    return await this.prisma.$transaction(async (tx) => {
      // 1. VALIDACIÓN DE CUPOS
      const occupiedSeats = await tx.enrollment.count({
        where: {
          classroomId: payload.classroomId,
          status: { in: ['INSCRITO', 'REVISION_SIE'] },
        },
      });

      const classroom = await tx.classroom.findUnique({
        where: { id: payload.classroomId },
      });

      if (!classroom) throw new NotFoundException('El curso no existe.');
      if (occupiedSeats >= classroom.capacity) {
        throw new BadRequestException(
          'El curso ya no tiene cupos disponibles.',
        );
      }

      // 2. SINCRONIZACIÓN DEL ESTUDIANTE
      let student;
      if (payload.ci) {
        student = await tx.student.upsert({
          where: { ci: payload.ci },
          update: {
            hasDisability: payload.hasDisability,
            hasAutism: payload.hasAutism,
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

      // 3. SINCRONIZACIÓN DE TUTORES
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

      // 4. CREACIÓN DEL EVENTO ANUAL
      const activeYear = await tx.academicYear.findFirst({
        where: { status: 'ACTIVE' },
      });
      if (!activeYear)
        throw new BadRequestException('No hay Gestión Académica activa.');

      const enrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          classroomId: payload.classroomId,
          academicYearId: activeYear.id,
          enrollmentType: payload.enrollmentType,
          status: 'REVISION_SIE',
        },
      });

      // 5. VOLCADO DEL FORMULARIO SOCIOECONÓMICO
      await tx.rudeRecord.create({
        data: {
          enrollmentId: enrollment.id,
          department: payload.department,
          province: payload.province,
          municipality: payload.municipality,
          street: payload.street,
          cellphone: payload.cellphone,
          nativeLanguage: payload.nativeLanguage,
          transportType: payload.transportType,
          transportTime: payload.transportTime,
          livesWith: payload.livesWith,
        },
      });

      return enrollment;
    });
  }

  // 🔥 BUSCADOR (Actualizado con ABAC)
  async findAll(query: QueryEnrollmentDto, user: any) {
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

    // ABAC: Si es Docente, limitamos la búsqueda a sus cursos
    let allowedClassroomIds: string[] | null = null;
    if (!user.permissions.includes(SystemPermissions.MANAGE_ALL)) {
      allowedClassroomIds = await this.getTeacherClassroomIds(user.userId);
    }

    let statusFilter: any = undefined;
    if (status) statusFilter = { in: status.split(',') };

    let classroomFilter: any = undefined;
    if (classroomId) {
      // Si pidió un curso específico y no es suyo (siendo profe), no devolverá nada
      if (allowedClassroomIds && !allowedClassroomIds.includes(classroomId)) {
        return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      }
      classroomFilter = { id: classroomId };
    } else if (level) {
      classroomFilter = {
        level: level,
        ...(allowedClassroomIds && { id: { in: allowedClassroomIds } }),
      };
    } else if (allowedClassroomIds) {
      classroomFilter = { id: { in: allowedClassroomIds } }; // Profe viendo lista general
    }

    const whereCondition: Prisma.EnrollmentWhereInput = {
      ...(academicYearId && { academicYearId }),
      ...(statusFilter && { status: statusFilter }),
      ...(enrollmentType && { enrollmentType }),
      ...(classroomFilter && { classroom: classroomFilter }),
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

    const [total, rawData] = await Promise.all([
      this.prisma.enrollment.count({ where: whereCondition }),
      this.prisma.enrollment.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
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
              guardians: { include: { guardian: { include: { user: true } } } },
            },
          },
          classroom: {
            select: { level: true, grade: true, section: true, shift: true },
          },
        },
      }),
    ]);

    const data = rawData.map((enrollment) => {
      let hasApp = false,
        hasEmail = false,
        hasPhone = false;
      let targetEmail: string | null = null,
        targetPhone: string | null = null;

      if (enrollment.student.guardians) {
        enrollment.student.guardians.forEach((g) => {
          if (g.guardian.user?.fcmTokens?.length) hasApp = true;
          if (g.guardian.user?.email || g.guardian.user?.recoveryEmail) {
            hasEmail = true;
            targetEmail =
              g.guardian.user?.email || g.guardian.user?.recoveryEmail || null;
          }
          if (g.guardian.phone) {
            hasPhone = true;
            targetPhone = g.guardian.phone;
          }
        });
      }
      const { guardians, ...studentClean } = enrollment.student;
      return {
        ...enrollment,
        student: studentClean,
        contactStatus: { hasApp, hasEmail, targetEmail, hasPhone, targetPhone },
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // 🔥 DETALLE COMPLETO (Con ABAC)
  async findOne(id: string, user: any) {
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
                guardian: {
                  include: {
                    students: {
                      include: {
                        student: {
                          include: {
                            enrollments: {
                              where: {
                                academicYear: { status: 'ACTIVE' },
                                status: 'INSCRITO',
                              },
                              include: { classroom: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!enrollment) throw new NotFoundException(`Inscripción no encontrada.`);

    // ABAC: Si es profe, verificamos que el alumno esté en su curso
    if (!user.permissions.includes(SystemPermissions.MANAGE_ALL)) {
      const allowedClassroomIds = await this.getTeacherClassroomIds(
        user.userId,
      );
      if (!allowedClassroomIds.includes(enrollment.classroomId)) {
        throw new ForbiddenException(
          'Privacidad: Este estudiante no pertenece a sus cursos.',
        );
      }
    }

    const siblingsMap = new Map();
    if (enrollment.student.guardians) {
      enrollment.student.guardians.forEach((sg) => {
        sg.guardian.students.forEach((siblingLink) => {
          const sibling = siblingLink.student;
          if (sibling.id !== enrollment.studentId) {
            const activeEnrollment = sibling.enrollments[0];
            siblingsMap.set(sibling.id, {
              id: sibling.id,
              names:
                `${sibling.names} ${sibling.lastNamePaterno} ${sibling.lastNameMaterno || ''}`.trim(),
              ci: sibling.ci || 'Sin CI',
              classroom: activeEnrollment
                ? `${activeEnrollment.classroom.grade} "${activeEnrollment.classroom.section}" - ${activeEnrollment.classroom.level}`
                : 'No inscrito este año',
              sharedTutor: `${sg.guardian.names} ${sg.guardian.lastNamePaterno}`,
            });
          }
        });
      });
    }

    return {
      data: { ...enrollment, siblings: Array.from(siblingsMap.values()) },
    };
  }

  // 🔥 KARDEX LIGERO (Con ABAC)
  async findKardex(id: string, user: any) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        enrollmentType: true,
        classroomId: true,
        academicYear: { select: { year: true } },
        classroom: {
          select: { grade: true, section: true, level: true, shift: true },
        },
        rudeRecord: { select: { street: true, houseNumber: true, zone: true } },
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

    if (!enrollment) throw new NotFoundException(`Kardex no encontrado.`);

    // ABAC
    if (!user.permissions.includes(SystemPermissions.MANAGE_ALL)) {
      const allowedClassroomIds = await this.getTeacherClassroomIds(
        user.userId,
      );
      if (!allowedClassroomIds.includes(enrollment.classroomId)) {
        throw new ForbiddenException(
          'Privacidad: Este estudiante no pertenece a sus cursos.',
        );
      }
    }

    return { data: enrollment };
  }

  async update(id: string, updateEnrollmentDto: UpdateEnrollmentDto) {
    const { status, rudeCode, receivedDocuments, ...restData } =
      updateEnrollmentDto;

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!enrollment) throw new NotFoundException(`Inscripción no encontrada.`);

    if (status === 'INSCRITO') {
      const finalRudeCode = rudeCode || enrollment.student.rudeCode;
      if (enrollment.enrollmentType !== 'ANTIGUO' && !finalRudeCode) {
        throw new BadRequestException(
          `Operación denegada: Debe registrar el Código RUDE para finalizar inscripción.`,
        );
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedEnrollment = await tx.enrollment.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(receivedDocuments && { receivedDocuments }),
          ...restData,
        },
        include: { student: true, classroom: true },
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
    return `This action removes a #${id} enrollment`; // Dejar como TODO según necesidades del colegio
  }
}

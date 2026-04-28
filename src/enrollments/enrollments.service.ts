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
import { EncryptionService } from '../common/services/encryption.service';

@Injectable()
export class EnrollmentsService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

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

      // 2. SINCRONIZACIÓN DEL ESTUDIANTE (CON BÓVEDA DE DATOS)
      let student;
      if (payload.ci) {
        const studentCiHash = this.encryptionService.generateBlindIndex(
          payload.ci,
        ) as string;
        const studentCiEnc = this.encryptionService.encrypt(payload.ci);

        student = await tx.student.upsert({
          where: { ciHash: studentCiHash },
          update: {
            hasDisability: payload.hasDisability,
            hasAutism: payload.hasAutism,
            ci: studentCiEnc,
          },
          create: {
            ciHash: studentCiHash,
            ci: studentCiEnc,
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

      // 3. SINCRONIZACIÓN DE TUTORES (CON BÓVEDA DE DATOS)
      if (payload.guardians && payload.guardians.length > 0) {
        for (const tutor of payload.guardians) {
          const tutorCiHash = this.encryptionService.generateBlindIndex(
            tutor.ci,
          ) as string;
          const tutorCiEnc = this.encryptionService.encrypt(tutor.ci);

          const guardian = await tx.guardian.upsert({
            where: { ciHash: tutorCiHash },
            update: {
              ci: tutorCiEnc,
              phone: tutor.phone
                ? this.encryptionService.encrypt(tutor.phone)
                : null,
              occupation: tutor.occupation,
              educationLevel: tutor.educationLevel,
            },
            create: {
              ciHash: tutorCiHash,
              ci: tutorCiEnc,
              names: tutor.names,
              lastNamePaterno: tutor.lastNamePaterno,
              lastNameMaterno: tutor.lastNameMaterno,
              phone: tutor.phone
                ? this.encryptionService.encrypt(tutor.phone)
                : null,
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
          street: payload.street
            ? this.encryptionService.encrypt(payload.street)
            : null,
          cellphone: payload.cellphone
            ? this.encryptionService.encrypt(payload.cellphone)
            : null,
          nativeLanguage: payload.nativeLanguage,
          transportType: payload.transportType,
          transportTime: payload.transportTime,
          livesWith: payload.livesWith,
        },
      });

      return enrollment;
    });
  }

  // 🔥 BUSCADOR (100% PURO - SIN ROLES EN CÓDIGO)
  async findAll(
    query: QueryEnrollmentDto,
    policyScope: Prisma.EnrollmentWhereInput,
  ) {
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

    let statusFilter: any = undefined;
    if (status) statusFilter = { in: status.split(',') };

    const searchHash = search
      ? this.encryptionService.generateBlindIndex(search)
      : null;

    // 🔥 FUSIONAMOS EL FILTRO DEL USUARIO CON EL ALCANCE DE LA POLÍTICA
    const whereCondition: Prisma.EnrollmentWhereInput = {
      AND: [
        policyScope,
        {
          ...(academicYearId && { academicYearId }),
          ...(statusFilter && { status: statusFilter }),
          ...(enrollmentType && { enrollmentType }),
          ...(classroomId && { classroomId }),
          ...(level && { classroom: { level } }),
          ...(search && {
            student: {
              OR: [
                { names: { contains: search, mode: 'insensitive' } },
                { lastNamePaterno: { contains: search, mode: 'insensitive' } },
                { lastNameMaterno: { contains: search, mode: 'insensitive' } },
                { rudeCode: { contains: search, mode: 'insensitive' } },
                ...(searchHash ? [{ ciHash: searchHash }] : []),
              ],
            },
          }),
        },
      ],
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
            targetPhone = this.encryptionService.decrypt(g.guardian.phone);
          }
        });
      }
      const { guardians, ...studentClean } = enrollment.student;

      studentClean.ci = this.encryptionService.decrypt(studentClean.ci);

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

  // 🔥 DETALLE COMPLETO (PURO)
  async findOne(id: string, policyScope: Prisma.EnrollmentWhereInput) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id,
        AND: [policyScope],
      },
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

    if (!enrollment) {
      throw new NotFoundException(
        `Inscripción no encontrada o no tienes permisos para ver a este estudiante.`,
      );
    }

    enrollment.student.ci = this.encryptionService.decrypt(
      enrollment.student.ci,
    );
    if (enrollment.rudeRecord) {
      enrollment.rudeRecord.street = this.encryptionService.decrypt(
        enrollment.rudeRecord.street,
      );
      enrollment.rudeRecord.cellphone = this.encryptionService.decrypt(
        enrollment.rudeRecord.cellphone,
      );
      enrollment.rudeRecord.phone = this.encryptionService.decrypt(
        enrollment.rudeRecord.phone,
      );
    }

    const siblingsMap = new Map();
    if (enrollment.student.guardians) {
      enrollment.student.guardians.forEach((sg) => {
        sg.guardian.ci = this.encryptionService.decrypt(sg.guardian.ci);
        sg.guardian.phone = this.encryptionService.decrypt(sg.guardian.phone);

        sg.guardian.students.forEach((siblingLink) => {
          const sibling = siblingLink.student;
          if (sibling.id !== enrollment.studentId) {
            const activeEnrollment = sibling.enrollments[0];
            siblingsMap.set(sibling.id, {
              id: sibling.id,
              names:
                `${sibling.names} ${sibling.lastNamePaterno} ${sibling.lastNameMaterno || ''}`.trim(),
              ci: this.encryptionService.decrypt(sibling.ci) || 'Sin CI',
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

  // 🔥 KARDEX LIGERO (PURO)
  async findKardex(id: string, policyScope: Prisma.EnrollmentWhereInput) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id,
        AND: [policyScope],
      },
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

    if (!enrollment) {
      throw new NotFoundException(
        `Kardex no encontrado o no tienes permisos para verlo.`,
      );
    }

    enrollment.student.ci = this.encryptionService.decrypt(
      enrollment.student.ci,
    );
    if (enrollment.rudeRecord) {
      enrollment.rudeRecord.street = this.encryptionService.decrypt(
        enrollment.rudeRecord.street,
      );
    }
    enrollment.student.guardians.forEach((g) => {
      g.guardian.ci = this.encryptionService.decrypt(g.guardian.ci);
      g.guardian.phone = this.encryptionService.decrypt(g.guardian.phone);
    });

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
    return `This action removes a #${id} enrollment`;
  }
}

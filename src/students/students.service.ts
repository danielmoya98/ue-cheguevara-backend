import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFullRudeDto } from './dto/create-student.dto';
import { EnrollmentStatus } from '../../prisma/generated/client';
import * as xlsx from 'xlsx';
import { EncryptionService } from '../common/services/encryption.service'; // 🔥 IMPORTADO

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService, // 🔥 INYECTADO
  ) {}

  async registerFullRude(data: CreateFullRudeDto) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. VALIDACIÓN DE CUPOS DEL CURSO
      const classroom = await tx.classroom.findUnique({
        where: { id: data.classroomId },
        include: {
          _count: {
            select: {
              enrollments: {
                where: {
                  status: {
                    in: [
                      EnrollmentStatus.INSCRITO,
                      EnrollmentStatus.REVISION_SIE,
                      EnrollmentStatus.OBSERVADO,
                    ],
                  },
                },
              },
            },
          },
        },
      });

      if (!classroom) throw new BadRequestException('El curso no existe');
      if (classroom._count.enrollments >= classroom.capacity) {
        throw new ConflictException(
          `El paralelo ${classroom.grade} "${classroom.section}" ha alcanzado su límite máximo de ${classroom.capacity} cupos.`,
        );
      }

      // 2. CREAR O BUSCAR AL ESTUDIANTE (BÚSQUEDA SEGURA)
      let student;
      if (data.ci && data.ci.trim() !== '') {
        const studentCiHash = this.encryptionService.generateBlindIndex(
          data.ci,
        ) as string;
        student = await tx.student.findUnique({
          where: { ciHash: studentCiHash },
        });
      }

      if (!student) {
        student = await tx.student.create({
          data: {
            // 🔥 Guardamos encriptado y con Hash
            ciHash: data.ci
              ? this.encryptionService.generateBlindIndex(data.ci)
              : undefined,
            ci: data.ci ? this.encryptionService.encrypt(data.ci) : undefined,

            complement: data.complement,
            expedition: data.expedition,
            documentType: data.documentType,
            names: data.names,
            lastNamePaterno: data.lastNamePaterno,
            lastNameMaterno: data.lastNameMaterno,
            birthDate: new Date(data.birthDate),
            gender: data.gender,
            birthCountry: data.birthCountry,
            birthDepartment: data.birthDepartment,
            birthProvince: data.birthProvince,
            birthLocality: data.birthLocality,

            // Los certificados quedan listos para Fase 2 estricta si decides encriptarlos aquí
            certOficialia: data.certOficialia,
            certLibro: data.certLibro,
            certPartida: data.certPartida,
            certFolio: data.certFolio,

            hasDisability: data.hasDisability ?? false,
            disabilityRegistry: data.disabilityRegistry,
            disabilityCode: data.disabilityCode,
            disabilityType: data.disabilityType,
            disabilityDegree: data.disabilityDegree,
            disabilityOrigin: data.disabilityOrigin,
            hasAutism: data.hasAutism ?? false,
            autismType: data.autismType,
            learningDisabilityStatus: data.learningDisabilityStatus,
            learningDisabilityTypes: data.learningDisabilityTypes || [],
            learningSupportLocation: data.learningSupportLocation || [],
            hasExtraordinaryTalent: data.hasExtraordinaryTalent ?? false,
            talentType: data.talentType,
            talentSpecifics: data.talentSpecifics || [],
            talentIQ: data.talentIQ,
            talentModality: data.talentModality || [],

            rudeCode: data.rudeCode,
          },
        });
      }

      // 3. VALIDAR DUPLICIDAD EN LA GESTIÓN
      const existingEnrollment = await tx.enrollment.findUnique({
        where: {
          studentId_academicYearId: {
            studentId: student.id,
            academicYearId: data.academicYearId,
          },
        },
      });

      if (existingEnrollment) {
        throw new ConflictException(
          'Este estudiante ya se encuentra inscrito en la gestión actual.',
        );
      }

      // 4. CREAR A LOS TUTORES (BÚSQUEDA SEGURA)
      for (const guardianData of data.guardians) {
        let guardian;
        if (guardianData.ci) {
          const tutorCiHash = this.encryptionService.generateBlindIndex(
            guardianData.ci,
          ) as string;
          guardian = await tx.guardian.findUnique({
            where: { ciHash: tutorCiHash },
          });
        }

        if (!guardian) {
          guardian = await tx.guardian.create({
            data: {
              // 🔥 Guardamos encriptado y con Hash
              ciHash: guardianData.ci
                ? this.encryptionService.generateBlindIndex(guardianData.ci)
                : undefined,
              ci: guardianData.ci
                ? this.encryptionService.encrypt(guardianData.ci)
                : undefined,

              complement: guardianData.complement,
              expedition: guardianData.expedition,
              names: guardianData.names,
              lastNamePaterno: guardianData.lastNamePaterno,
              lastNameMaterno: guardianData.lastNameMaterno,

              // 🔥 Teléfono encriptado
              phone: guardianData.phone
                ? this.encryptionService.encrypt(guardianData.phone)
                : undefined,

              language: guardianData.language,
              occupation: guardianData.occupation,
              educationLevel: guardianData.educationLevel,
              birthDate: guardianData.birthDate
                ? new Date(guardianData.birthDate)
                : null,
              jobTitle: guardianData.jobTitle,
              institution: guardianData.institution,
            },
          });
        }

        await tx.studentGuardian.upsert({
          where: {
            studentId_guardianId: {
              studentId: student.id,
              guardianId: guardian.id,
            },
          },
          update: { relationship: guardianData.relationship },
          create: {
            studentId: student.id,
            guardianId: guardian.id,
            relationship: guardianData.relationship,
          },
        });
      }

      // 5. CREAR LA INSCRIPCIÓN OFICIAL
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          classroomId: data.classroomId,
          academicYearId: data.academicYearId,
          enrollmentType: data.enrollmentType,
          status: EnrollmentStatus.REVISION_SIE,
        },
      });

      // 6. GUARDAR EL FORMULARIO RUDE
      if (data.rudeData) {
        await tx.rudeRecord.create({
          data: {
            enrollmentId: enrollment.id,
            ...data.rudeData,
          },
        });
      }

      return {
        message: 'Inscripción y Formulario RUDE procesados con éxito',
        studentId: student.id,
        enrollmentId: enrollment.id,
      };
    });
  }

  async importStudentsFromExcel(
    file: Express.Multer.File,
    academicYearId: string,
    globalStatus: string,
    classroomId: string,
  ) {
    if (!file)
      throw new BadRequestException('No se proporcionó ningún archivo');
    if (!classroomId)
      throw new BadRequestException('Debe seleccionar un curso destino');

    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0)
      throw new BadRequestException('El archivo Excel está vacío');

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const [index, row] of data.entries()) {
      try {
        const rowData = row as any;

        const ciEstudiante = rowData.CI_Estudiante
          ? String(rowData.CI_Estudiante).trim()
          : null;
        const nombres = rowData.Nombres ? String(rowData.Nombres).trim() : null;
        const rudeCode = rowData.RUDE ? String(rowData.RUDE).trim() : null;
        const ciTutor = rowData.CI_Tutor
          ? String(rowData.CI_Tutor).trim()
          : null;
        const nombresTutor = rowData.Nombres_Tutor
          ? String(rowData.Nombres_Tutor).trim()
          : null;

        if (!nombres || !ciEstudiante || !ciTutor || !nombresTutor) {
          throw new Error(
            'Faltan datos obligatorios para el Kardex (Nombres, CI_Estudiante, CI_Tutor o Nombres_Tutor)',
          );
        }

        await this.prisma.$transaction(async (tx) => {
          // --- A. MANEJO DEL ESTUDIANTE (BÚSQUEDA SEGURA) ---
          const studentCiHash = this.encryptionService.generateBlindIndex(
            ciEstudiante,
          ) as string;
          let student = await tx.student.findUnique({
            where: { ciHash: studentCiHash },
          });

          if (!student) {
            student = await tx.student.create({
              data: {
                // 🔥 Guardamos encriptado y con Hash
                ciHash: studentCiHash,
                ci: this.encryptionService.encrypt(ciEstudiante),

                documentType: 'CI',
                names: nombres.toUpperCase(),
                lastNamePaterno: rowData.Apellido_Paterno
                  ? String(rowData.Apellido_Paterno).toUpperCase()
                  : null,
                lastNameMaterno: rowData.Apellido_Materno
                  ? String(rowData.Apellido_Materno).toUpperCase()
                  : null,
                birthDate: rowData.Fecha_Nacimiento
                  ? new Date(rowData.Fecha_Nacimiento)
                  : new Date(),
                gender: String(rowData.Genero).toUpperCase().startsWith('M')
                  ? 'MASCULINO'
                  : 'FEMENINO',
                rudeCode: rudeCode,
              },
            });
          } else if (rudeCode) {
            await tx.student.update({
              where: { id: student.id },
              data: { rudeCode: rudeCode },
            });
          }

          // --- B. MANEJO DEL TUTOR Y HERMANOS (BÚSQUEDA SEGURA) ---
          const tutorCiHash = this.encryptionService.generateBlindIndex(
            ciTutor,
          ) as string;
          let guardian = await tx.guardian.findUnique({
            where: { ciHash: tutorCiHash },
          });

          if (!guardian) {
            const rawPhone = rowData.Celular_Tutor
              ? String(rowData.Celular_Tutor)
              : null;

            guardian = await tx.guardian.create({
              data: {
                // 🔥 Guardamos encriptado y con Hash
                ciHash: tutorCiHash,
                ci: this.encryptionService.encrypt(ciTutor),

                names: nombresTutor.toUpperCase(),
                lastNamePaterno: rowData.Paterno_Tutor
                  ? String(rowData.Paterno_Tutor).toUpperCase()
                  : null,

                // 🔥 Teléfono encriptado
                phone: rawPhone
                  ? this.encryptionService.encrypt(rawPhone)
                  : null,
              },
            });
          }

          await tx.studentGuardian.upsert({
            where: {
              studentId_guardianId: {
                studentId: student.id,
                guardianId: guardian.id,
              },
            },
            update: {},
            create: {
              studentId: student.id,
              guardianId: guardian.id,
              relationship: rowData.Parentesco || 'TUTOR',
            },
          });

          // --- C. CUPOS EN TIEMPO REAL ---
          const classroom = await tx.classroom.findUnique({
            where: { id: classroomId },
            include: {
              _count: {
                select: {
                  enrollments: {
                    where: {
                      status: { in: ['INSCRITO', 'REVISION_SIE', 'OBSERVADO'] },
                    },
                  },
                },
              },
            },
          });

          if (!classroom) throw new Error(`El curso destino no existe.`);
          if (classroom._count.enrollments >= classroom.capacity) {
            throw new Error(
              `El curso ${classroom.grade} "${classroom.section}" está lleno.`,
            );
          }

          // --- D. DUPLICIDAD ---
          const exists = await tx.enrollment.findUnique({
            where: {
              studentId_academicYearId: {
                studentId: student.id,
                academicYearId,
              },
            },
          });

          if (exists)
            throw new Error(`El estudiante ya está inscrito en esta gestión.`);

          // --- E. INSCRIPCIÓN ---
          let finalStatus = globalStatus || rowData.Estado || 'REVISION_SIE';

          if (!rudeCode) {
            finalStatus = 'REVISION_SIE';
          }

          const enrollment = await tx.enrollment.create({
            data: {
              studentId: student.id,
              classroomId: classroomId,
              academicYearId: academicYearId,
              enrollmentType: rowData.Tipo_Inscripcion || 'NUEVO',
              status: finalStatus as any,
            },
          });

          await tx.rudeRecord.create({
            data: { enrollmentId: enrollment.id },
          });
        });

        successCount++;
      } catch (error: any) {
        errorCount++;
        errors.push(`Fila ${index + 2}: ${error.message}`);
      }
    }

    return {
      message: 'Procesamiento de Excel finalizado',
      totalRowsProcessed: data.length,
      successCount,
      errorCount,
      errors,
    };
  }
}

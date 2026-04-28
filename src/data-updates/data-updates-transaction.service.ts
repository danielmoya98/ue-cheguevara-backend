import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service'; // 🔥 IMPORTADO

@Injectable()
export class DataUpdatesTransactionService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService, // 🔥 INYECTADO
  ) {}

  // ====================================================================
  // EJECUTOR DE TRANSACCIÓN MAESTRA (Fusión de Datos con Bóveda)
  // ====================================================================
  async executeApprovalTransaction(
    requestId: string,
    studentId: string,
    enrollmentId: string,
    data: any,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. ACTUALIZAMOS AL ESTUDIANTE (CON ENCRIPTACIÓN)
      await tx.student.update({
        where: { id: studentId },
        data: {
          names: data.names,
          lastNamePaterno: data.lastNamePaterno,
          lastNameMaterno: data.lastNameMaterno,
          birthCountry: data.birthCountry,
          birthDepartment: data.birthDepartment,
          birthProvince: data.birthProvince,
          birthLocality: data.birthLocality,
          birthDate: new Date(data.birthDate),
          certOficialia: data.certOficialia
            ? this.encryptionService.encrypt(data.certOficialia)
            : undefined,
          certLibro: data.certLibro
            ? this.encryptionService.encrypt(data.certLibro)
            : undefined,
          certPartida: data.certPartida
            ? this.encryptionService.encrypt(data.certPartida)
            : undefined,
          certFolio: data.certFolio
            ? this.encryptionService.encrypt(data.certFolio)
            : undefined,
          documentType: data.documentType,

          // 🔥 Hasheo y encriptación simultánea del CI
          ciHash: data.ci
            ? this.encryptionService.generateBlindIndex(data.ci)
            : undefined,
          ci: data.ci ? this.encryptionService.encrypt(data.ci) : undefined,

          complement: data.complement,
          expedition: data.expedition,
          gender: data.gender,
          hasDisability: data.hasDisability,
          disabilityRegistry: data.disabilityRegistry
            ? this.encryptionService.encrypt(data.disabilityRegistry)
            : undefined,
          disabilityCode: data.disabilityCode
            ? this.encryptionService.encrypt(data.disabilityCode)
            : undefined,
          disabilityType: data.disabilityType
            ? this.encryptionService.encrypt(data.disabilityType)
            : undefined,
          disabilityDegree: data.disabilityDegree,
          disabilityOrigin: data.disabilityOrigin,
          hasAutism: data.hasAutism,
          autismType: data.autismType
            ? this.encryptionService.encrypt(data.autismType)
            : undefined,
          learningDisabilityStatus: data.learningDisabilityStatus,
          learningDisabilityTypes: data.learningDisabilityTypes || [],
          learningSupportLocation: data.learningSupportLocation || [],
          hasExtraordinaryTalent: data.hasExtraordinaryTalent,
          talentType: data.talentType,
          talentSpecifics: data.talentSpecifics || [],
          talentIQ: data.talentIQ
            ? this.encryptionService.encrypt(data.talentIQ)
            : undefined,
          talentModality: data.talentModality || [],
        },
      });

      // 2. ACTUALIZAMOS EL FORMULARIO RUDE
      await tx.rudeRecord.upsert({
        where: { enrollmentId: enrollmentId },
        update: {
          department: data.department,
          province: data.province,
          municipality: data.municipality,
          locality: data.locality,
          zone: data.zone,
          street: data.street
            ? this.encryptionService.encrypt(data.street)
            : undefined,
          houseNumber: data.houseNumber,
          phone: data.phone
            ? this.encryptionService.encrypt(data.phone)
            : undefined,
          cellphone: data.cellphone
            ? this.encryptionService.encrypt(data.cellphone)
            : undefined,
          nativeLanguage: data.nativeLanguage,
          frequentLanguages: data.frequentLanguages
            ? data.frequentLanguages.split(',').map((s: string) => s.trim())
            : [],
          culturalIdentity: data.culturalIdentity,
          nearestHealthCenter: data.nearestHealthCenter,
          healthCareLocations: data.healthCareLocations || [],
          healthCenterVisits: data.healthCenterVisits,
          healthInsurance: data.healthInsurance,
          water: data.water,
          bathroom: data.bathroom,
          sewage: data.sewage,
          electricity: data.electricity,
          garbage: data.garbage,
          housingType: data.housingType,
          internetAccess: data.internetAccess || [],
          internetFrequency: data.internetFrequency,
          didWork: data.didWork,
          workedMonths: data.workedMonths || [],
          workType: data.workType,
          workShift: data.workShift || [],
          workFrequency: data.workFrequency,
          gotPaid: data.gotPaid,
          transportType: data.transportType,
          transportTime: data.transportTime,
          abandonedLastYear: data.abandonedLastYear,
          abandonReasons: data.abandonReasons || [],
          livesWith: data.livesWith,
        },
        create: {
          enrollmentId: enrollmentId,
          department: data.department,
          province: data.province,
          municipality: data.municipality,
          locality: data.locality,
          zone: data.zone,
          street: data.street
            ? this.encryptionService.encrypt(data.street)
            : null,
          houseNumber: data.houseNumber,
          phone: data.phone ? this.encryptionService.encrypt(data.phone) : null,
          cellphone: data.cellphone
            ? this.encryptionService.encrypt(data.cellphone)
            : null,
          nativeLanguage: data.nativeLanguage,
          frequentLanguages: data.frequentLanguages
            ? data.frequentLanguages.split(',').map((s: string) => s.trim())
            : [],
          culturalIdentity: data.culturalIdentity,
          nearestHealthCenter: data.nearestHealthCenter,
          healthCareLocations: data.healthCareLocations || [],
          healthCenterVisits: data.healthCenterVisits,
          healthInsurance: data.healthInsurance,
          water: data.water,
          bathroom: data.bathroom,
          sewage: data.sewage,
          electricity: data.electricity,
          garbage: data.garbage,
          housingType: data.housingType,
          internetAccess: data.internetAccess || [],
          internetFrequency: data.internetFrequency,
          didWork: data.didWork,
          workedMonths: data.workedMonths || [],
          workType: data.workType,
          workShift: data.workShift || [],
          workFrequency: data.workFrequency,
          gotPaid: data.gotPaid,
          transportType: data.transportType,
          transportTime: data.transportTime,
          abandonedLastYear: data.abandonedLastYear,
          abandonReasons: data.abandonReasons || [],
          livesWith: data.livesWith,
        },
      });

      // 3. ACTUALIZAMOS TUTORES
      if (data.guardians && data.guardians.length > 0) {
        await tx.studentGuardian.deleteMany({
          where: { studentId: studentId },
        });

        for (const tutor of data.guardians) {
          const tutorCiHash = this.encryptionService.generateBlindIndex(
            tutor.ci,
          ) as string;
          const tutorCiEnc = this.encryptionService.encrypt(tutor.ci);

          const guardian = await tx.guardian.upsert({
            where: { ciHash: tutorCiHash }, // 🔥 Búsqueda segura
            update: {
              ci: tutorCiEnc,
              names: tutor.names,
              lastNamePaterno: tutor.lastNamePaterno,
              lastNameMaterno: tutor.lastNameMaterno,
              phone: tutor.phone
                ? this.encryptionService.encrypt(tutor.phone)
                : undefined,
              occupation: tutor.occupation,
              educationLevel: tutor.educationLevel,
              language: tutor.language,
              birthDate: tutor.birthDate ? new Date(tutor.birthDate) : null,
              jobTitle: tutor.jobTitle,
              institution: tutor.institution,
            },
            create: {
              ciHash: tutorCiHash,
              ci: tutorCiEnc,
              complement: tutor.complement,
              expedition: tutor.expedition,
              names: tutor.names,
              lastNamePaterno: tutor.lastNamePaterno,
              lastNameMaterno: tutor.lastNameMaterno,
              phone: tutor.phone
                ? this.encryptionService.encrypt(tutor.phone)
                : null,
              occupation: tutor.occupation,
              educationLevel: tutor.educationLevel,
              language: tutor.language,
              birthDate: tutor.birthDate ? new Date(tutor.birthDate) : null,
              jobTitle: tutor.jobTitle,
              institution: tutor.institution,
            },
          });

          await tx.studentGuardian.create({
            data: {
              studentId: studentId,
              guardianId: guardian.id,
              relationship: tutor.relationship,
            },
          });
        }
      }

      // 4. ACTUALIZAMOS CONTADORES Y ESTADO DE LA SOLICITUD
      await tx.enrollment.update({
        where: { id: enrollmentId },
        data: { rudeUpdateCount: { increment: 1 } },
      });

      const finalRequest = await tx.dataUpdateRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', reviewedAt: new Date() },
      });

      return finalRequest;
    });
  }
}

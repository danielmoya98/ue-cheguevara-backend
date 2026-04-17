import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DataUpdatesTransactionService {
  constructor(private prisma: PrismaService) {}

  // ====================================================================
  // EJECUTOR DE TRANSACCIÓN MAESTRA (Fusión de Datos)
  // ====================================================================
  async executeApprovalTransaction(requestId: string, studentId: string, enrollmentId: string, data: any) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. ACTUALIZAMOS AL ESTUDIANTE
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
          certOficialia: data.certOficialia,
          certLibro: data.certLibro,
          certPartida: data.certPartida,
          certFolio: data.certFolio,
          documentType: data.documentType,
          ci: data.ci,
          complement: data.complement,
          expedition: data.expedition,
          gender: data.gender,
          hasDisability: data.hasDisability,
          disabilityRegistry: data.disabilityRegistry,
          disabilityCode: data.disabilityCode,
          disabilityType: data.disabilityType,
          disabilityDegree: data.disabilityDegree,
          disabilityOrigin: data.disabilityOrigin,
          hasAutism: data.hasAutism,
          autismType: data.autismType,
          learningDisabilityStatus: data.learningDisabilityStatus,
          learningDisabilityTypes: data.learningDisabilityTypes || [],
          learningSupportLocation: data.learningSupportLocation || [],
          hasExtraordinaryTalent: data.hasExtraordinaryTalent,
          talentType: data.talentType,
          talentSpecifics: data.talentSpecifics || [],
          talentIQ: data.talentIQ,
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
          street: data.street,
          houseNumber: data.houseNumber,
          phone: data.phone,
          cellphone: data.cellphone,
          nativeLanguage: data.nativeLanguage,
          frequentLanguages: data.frequentLanguages ? data.frequentLanguages.split(',').map((s: string) => s.trim()) : [],
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
          street: data.street,
          houseNumber: data.houseNumber,
          phone: data.phone,
          cellphone: data.cellphone,
          nativeLanguage: data.nativeLanguage,
          frequentLanguages: data.frequentLanguages ? data.frequentLanguages.split(',').map((s: string) => s.trim()) : [],
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
        await tx.studentGuardian.deleteMany({ where: { studentId: studentId } });

        for (const tutor of data.guardians) {
          const guardian = await tx.guardian.upsert({
            where: { ci: tutor.ci },
            update: {
              names: tutor.names,
              lastNamePaterno: tutor.lastNamePaterno,
              lastNameMaterno: tutor.lastNameMaterno,
              phone: tutor.phone,
              occupation: tutor.occupation,
              educationLevel: tutor.educationLevel,
              language: tutor.language,
              birthDate: tutor.birthDate ? new Date(tutor.birthDate) : null,
              jobTitle: tutor.jobTitle,
              institution: tutor.institution,
            },
            create: {
              ci: tutor.ci,
              complement: tutor.complement,
              expedition: tutor.expedition,
              names: tutor.names,
              lastNamePaterno: tutor.lastNamePaterno,
              lastNameMaterno: tutor.lastNameMaterno,
              phone: tutor.phone,
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
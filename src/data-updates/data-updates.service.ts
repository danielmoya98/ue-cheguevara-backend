import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { FirebaseService } from '../firebase/firebase.service'; // 🔥 IMPORTAR

@Injectable()
export class DataUpdatesService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private firebaseService: FirebaseService,
  ) {}

  // ====================================================================
  // 🛡️ REGLAS DE SEGURIDAD Y LÍMITES
  // ====================================================================
  private async validateCampaignAndLimits(enrollmentId: string) {
    // 1. Verificamos la configuración de la Institución (Asumiendo que hay una principal)
    const institution = await this.prisma.institution.findFirst();

    if (!institution || !institution.enableDigitalRudeUpdates) {
      throw new BadRequestException(
        'El periodo de actualización digital de datos se encuentra cerrado.',
      );
    }

    // 2. Buscamos la inscripción y sus datos actuales
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: {
          include: {
            guardians: { include: { guardian: true } },
          },
        },
        rudeRecord: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Inscripción no encontrada.');
    }

    // 3. Verificamos que el estudiante siga activo en el colegio
    if (enrollment.status === 'RETIRADO' || enrollment.status === 'TRASLADO') {
      throw new BadRequestException(
        'No se pueden actualizar los datos de un estudiante inactivo o trasladado.',
      );
    }

    // 4. Verificamos el límite de actualizaciones por año
    if (enrollment.rudeUpdateCount >= institution.maxRudeUpdatesPerYear) {
      throw new BadRequestException(
        `Ha superado el límite máximo de ${institution.maxRudeUpdatesPerYear} actualizaciones permitidas por año. Por favor, acérquese a Secretaría para cambios adicionales.`,
      );
    }

    return enrollment;
  }

  // ====================================================================
  // 🌐 LECTURA: EL PADRE ABRE EL ENLACE (Pre-llenado)
  // ====================================================================
  async verifyTokenAndGetData(token: string) {
    let enrollmentId: string;

    // 1. Desencriptamos el token
    try {
      const payload = await this.jwtService.verifyAsync(token);
      enrollmentId = payload.enrollmentId;
    } catch (error) {
      throw new UnauthorizedException(
        'El enlace es inválido o ha expirado por seguridad. Solicite uno nuevo al colegio.',
      );
    }

    // 2. Aplicamos todas las reglas de seguridad
    const enrollment = await this.validateCampaignAndLimits(enrollmentId);

    // 3. Verificamos si el padre ya mandó un formulario y está esperando revisión
    const pendingRequest = await this.prisma.dataUpdateRequest.findFirst({
      where: {
        enrollmentId: enrollmentId,
        status: 'PENDING',
      },
    });

    if (pendingRequest) {
      throw new BadRequestException(
        'Sus datos ya fueron enviados y se encuentran en revisión por Secretaría. No puede enviar otra solicitud en este momento.',
      );
    }

    // Retornamos los datos limpios para que el Frontend de Next.js pre-llene el Zod Form
    return {
      message: 'Enlace verificado correctamente',
      data: {
        enrollmentId: enrollment.id,
        enrollmentType: enrollment.enrollmentType,
        rudeCode: enrollment.student.rudeCode,

        // Datos del Estudiante
        student: {
          names: enrollment.student.names,
          lastNamePaterno: enrollment.student.lastNamePaterno,
          lastNameMaterno: enrollment.student.lastNameMaterno,
          ci: enrollment.student.ci,
          documentType: enrollment.student.documentType,
          birthDate: enrollment.student.birthDate,
          gender: enrollment.student.gender,
          // ... (se envía todo el perfil actual)
        },

        // Tutores
        guardians: enrollment.student.guardians.map((g) => ({
          relationship: g.relationship,
          ...g.guardian,
        })),

        // Formulario Socioeconómico Actual
        rudeRecord: enrollment.rudeRecord,
      },
    };
  }

  // ====================================================================
  // 🌐 ESCRITURA: EL PADRE ENVÍA EL FORMULARIO (Cuarentena)
  // ====================================================================
  async submitUpdate(token: string, proposedData: any) {
    let enrollmentId: string;

    try {
      const payload = await this.jwtService.verifyAsync(token);
      enrollmentId = payload.enrollmentId;
    } catch (error) {
      throw new UnauthorizedException('El enlace es inválido o ha expirado.');
    }

    // Volvemos a validar las reglas por si acaso la secretaria apagó el switch mientras el padre llenaba el formulario
    await this.validateCampaignAndLimits(enrollmentId);

    // GUARDAMOS EN LA TABLA DE CUARENTENA (El Upsert)
    // Buscamos si ya había algo pendiente (por si el padre apretó el botón 2 veces rápido)
    const existingPending = await this.prisma.dataUpdateRequest.findFirst({
      where: { enrollmentId, status: 'PENDING' },
    });

    let requestRecord;

    if (existingPending) {
      // Sobrescribimos el existente
      requestRecord = await this.prisma.dataUpdateRequest.update({
        where: { id: existingPending.id },
        data: { proposedData },
      });
    } else {
      // Creamos uno nuevo en Cuarentena
      requestRecord = await this.prisma.dataUpdateRequest.create({
        data: {
          enrollmentId,
          proposedData,
          status: 'PENDING',
        },
      });
    }

    return {
      message:
        'Sus datos han sido enviados exitosamente y están a la espera de revisión por la Secretaría.',
      requestId: requestRecord.id,
    };
  }

  // ====================================================================
  // 🔒 GENERACIÓN DEL TOKEN (Será llamado internamente por Secretaría)
  // ====================================================================
  async generateUpdateToken(enrollmentId: string) {
    // Generamos un token válido por 7 días
    return this.jwtService.signAsync(
      { enrollmentId, purpose: 'RUDE_UPDATE' },
      { expiresIn: '7d' },
    );
  }

  // ====================================================================
  // 🔒 SECRETARÍA: LISTAR SOLICITUDES PENDIENTES
  // ====================================================================
  async getPendingRequests() {
    return this.prisma.dataUpdateRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        enrollment: {
          include: {
            student: {
              select: {
                ci: true,
                names: true,
                lastNamePaterno: true,
                lastNameMaterno: true,
              },
            },
            classroom: { select: { grade: true, section: true, level: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ====================================================================
  // 🔒 SECRETARÍA: RECHAZAR SOLICITUD (Datos falsos o erróneos)
  // ====================================================================
  async rejectUpdate(requestId: string, reason: string) {
    const request = await this.prisma.dataUpdateRequest.findUnique({
      where: { id: requestId },
      include: { enrollment: true },
    });
    if (!request || request.status !== 'PENDING') {
      throw new NotFoundException('La solicitud no existe o ya fue procesada.');
    }

    const updatedRequest = await this.prisma.dataUpdateRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    });

    // 🔥 INYECTA ESTO AQUÍ: Notificar al padre del rechazo
    await this.notifyGuardiansByStudentId(
      request.enrollment.studentId,
      '❌ Formulario RUDE Observado',
      `Su solicitud fue rechazada por Secretaría. Motivo: ${reason}. Por favor, corrija y vuelva a enviar.`,
    );

    return updatedRequest;
  }

  // ====================================================================
  // 🔒 SECRETARÍA: APROBAR Y FUSIONAR DATOS (El Núcleo Duro)
  // ====================================================================
  async approveUpdate(requestId: string) {
    const request = await this.prisma.dataUpdateRequest.findUnique({
      where: { id: requestId },
      include: { enrollment: { include: { student: true } } },
    });

    if (!request || request.status !== 'PENDING') {
      throw new BadRequestException(
        'La solicitud no existe o ya fue procesada.',
      );
    }

    if (
      request.enrollment.status === 'RETIRADO' ||
      request.enrollment.status === 'TRASLADO'
    ) {
      throw new BadRequestException(
        'No se pueden fusionar datos de un estudiante inactivo.',
      );
    }

    const data: any = request.proposedData; // El JSON del padre
    const studentId = request.enrollment.studentId;
    const enrollmentId = request.enrollmentId;

    // Iniciamos la Transacción Maestra
    return await this.prisma.$transaction(async (tx) => {
      // 1. ACTUALIZAMOS AL ESTUDIANTE (Tabla Student)
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

          // Salud y Capacidades Especiales
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

      // 2. ACTUALIZAMOS EL FORMULARIO RUDE (Tabla RudeRecord)
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
          // (Repetimos los mismos campos de arriba para el create)
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

      // 3. ACTUALIZAMOS TUTORES (Tabla Guardian y Pivote)
      if (data.guardians && data.guardians.length > 0) {
        // Borramos los vínculos anteriores para recrearlos limpios
        await tx.studentGuardian.deleteMany({
          where: { studentId: studentId },
        });

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

      await this.notifyGuardiansByStudentId(
        studentId,
        '✅ Actualización RUDE Aprobada',
        `Los datos de ${request.enrollment.student.names} han sido verificados y fusionados con el Kardex oficial.`,
      );

      return {
        message: 'Datos del estudiante actualizados y fusionados exitosamente.',
        status: finalRequest.status,
      };
    });
  }

  // ====================================================================
  // 🔥 NUEVO: DISPARAR NOTIFICACIÓN AL PADRE DESDE SECRETARÍA
  // ====================================================================
  async broadcastUpdateCampaign(enrollmentId: string) {
    // 1. Buscamos al estudiante y rastreamos hasta llegar a la cuenta de usuario de sus tutores
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: {
          include: {
            guardians: {
              include: {
                guardian: {
                  include: { user: true }, // Traemos al Usuario (donde está el FCM Token)
                },
              },
            },
          },
        },
      },
    });

    if (!enrollment) throw new NotFoundException('Inscripción no encontrada.');

    // 2. Recolectamos todos los tokens de los celulares de los tutores
    const fcmTokens = new Set<string>();
    enrollment.student.guardians.forEach((g) => {
      if (g.guardian.user && g.guardian.user.fcmTokens) {
        g.guardian.user.fcmTokens.forEach((token) => fcmTokens.add(token));
      }
    });

    const tokensArray = Array.from(fcmTokens);

    // FALLBACK: Si no tienen la app instalada
    if (tokensArray.length === 0) {
      return {
        status: 'FAILED_NO_DEVICES',
        message:
          'Ningún tutor tiene la aplicación móvil instalada. Considere usar WhatsApp o Formulario Físico.',
      };
    }

    // 3. Generamos el enlace seguro (Deep Link)
    const token = await this.generateUpdateToken(enrollmentId);
    const publicUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const updateUrl = `${publicUrl}/actualizar-datos/${token}`;

    // 4. Disparamos la Notificación Push a través de Firebase
    await this.firebaseService.sendMulticastNotification(
      tokensArray,
      'Actualización de Datos Requerida 🏫',
      `Por favor, actualice el formulario RUDE de ${enrollment.student.names} para la gestión actual.`,
      { updateUrl: updateUrl }, // 🔥 LA MAGIA DEL DEEP LINK
    );

    return {
      status: 'SUCCESS',
      message:
        'Notificación Push enviada correctamente a los dispositivos de los tutores.',
    };
  }

  // ====================================================================
  // 🔥 DISPARO TÁCTICO: POR CURSO / AULA
  // ====================================================================
  async broadcastToClassroom(classroomId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classroomId: classroomId,
        status: 'INSCRITO',
        academicYear: { status: 'ACTIVE' },
      },
      include: {
        student: {
          include: {
            guardians: { include: { guardian: { include: { user: true } } } },
          },
        },
      },
    });

    if (enrollments.length === 0)
      throw new NotFoundException(
        'No hay estudiantes inscritos en este curso.',
      );

    const fcmTokens = new Set<string>();
    enrollments.forEach((enrollment) => {
      enrollment.student.guardians.forEach((g) => {
        if (g.guardian.user?.fcmTokens) {
          g.guardian.user.fcmTokens.forEach((token) => fcmTokens.add(token));
        }
      });
    });

    const tokensArray = Array.from(fcmTokens);
    if (tokensArray.length === 0)
      throw new BadRequestException(
        'Ningún tutor de este curso tiene la App instalada.',
      );

    const publicUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    // Ojo: Aquí mandamos la URL base, ya que cada padre recibirá una notificación genérica que, al abrir la app,
    // buscará su propio JWT. (O puedes generar links en lote si el Flutter lo requiere así).
    await this.firebaseService.sendMulticastNotification(
      tokensArray,
      'Actualización RUDE 🏫',
      'El colegio requiere que actualice los datos de su hijo(a). Toque aquí.',
      { action: 'OPEN_RUDE_HUB' },
    );

    return {
      status: 'SUCCESS',
      message: `Notificación enviada a ${tokensArray.length} dispositivos del curso.`,
    };
  }

  // ====================================================================
  // 🔥 DISPARO NUCLEAR: TODO EL COLEGIO
  // ====================================================================
  async broadcastToAll() {
    // Buscamos usuarios con rol PADRE que tengan tokens
    const users = await this.prisma.user.findMany({
      where: {
        role: 'PADRE',
        status: 'ACTIVE',
        fcmTokens: { isEmpty: false }, // Prisma 5 soporta esto en arrays de PostgreSQL
      },
      select: { fcmTokens: true },
    });

    const fcmTokens = new Set<string>();
    users.forEach((user) =>
      user.fcmTokens.forEach((token) => fcmTokens.add(token)),
    );
    const tokensArray = Array.from(fcmTokens);

    if (tokensArray.length === 0)
      throw new BadRequestException(
        'No hay dispositivos registrados en el colegio.',
      );

    // Firebase permite un máximo de 500 tokens por envío. Lo dividimos en lotes.
    const chunkSize = 500;
    for (let i = 0; i < tokensArray.length; i += chunkSize) {
      const chunk = tokensArray.slice(i, i + chunkSize);
      await this.firebaseService.sendMulticastNotification(
        chunk,
        'Campaña RUDE Oficial 🏫',
        'Se ha habilitado la actualización de datos para la presente gestión. Ingrese a la App.',
        { action: 'OPEN_RUDE_HUB' },
      );
    }

    return {
      status: 'SUCCESS',
      message: `Campaña masiva enviada a ${tokensArray.length} dispositivos.`,
    };
  }

  // ====================================================================
  // 📝 SECRETARÍA: REGISTRAR ENTREGA FÍSICA (PAPEL)
  // ====================================================================
  async markPhysicalDelivery(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) throw new NotFoundException('Inscripción no encontrada.');

    // Aumentamos el contador a 99 (un número alto) para que el sistema asuma que ya cumplió
    // y la regla de validateCampaignAndLimits bloquee futuros envíos.
    await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { rudeUpdateCount: 99 },
    });

    return {
      message:
        'Entrega física registrada. El tutor ya no recibirá notificaciones de actualización.',
    };
  }

  // ====================================================================
  // HELPER: ENVIAR PUSH A LOS TUTORES DE UN ESTUDIANTE (Cierre de Ciclo)
  // ====================================================================
  private async notifyGuardiansByStudentId(
    studentId: string,
    title: string,
    body: string,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        guardians: { include: { guardian: { include: { user: true } } } },
      },
    });

    if (!student) return;

    const fcmTokens = new Set<string>();
    student.guardians.forEach((g) => {
      if (g.guardian.user?.fcmTokens) {
        g.guardian.user.fcmTokens.forEach((token) => fcmTokens.add(token));
      }
    });

    const tokensArray = Array.from(fcmTokens);
    if (tokensArray.length > 0) {
      // Mandamos la notificación Push silenciosamente en segundo plano
      await this.firebaseService
        .sendMulticastNotification(tokensArray, title, body)
        .catch((e) => console.error('Error FCM:', e));
    }
  }
}

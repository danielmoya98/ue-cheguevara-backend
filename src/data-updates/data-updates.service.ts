import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { DataUpdatesBroadcastService } from './data-updates-broadcast.service';
import { DataUpdatesTransactionService } from './data-updates-transaction.service';

@Injectable()
export class DataUpdatesService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private broadcastService: DataUpdatesBroadcastService,
    private transactionService: DataUpdatesTransactionService,
  ) {}

  // ====================================================================
  // 🛡️ REGLAS DE SEGURIDAD Y LÍMITES (Con blindaje de Año Académico)
  // ====================================================================
  private async validateCampaignAndLimits(enrollmentId: string) {
    const institution = await this.prisma.institution.findFirst();

    if (!institution || !institution.enableDigitalRudeUpdates) {
      throw new BadRequestException(
        'El periodo de actualización digital de datos se encuentra cerrado.',
      );
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: { include: { guardians: { include: { guardian: true } } } },
        rudeRecord: true,
        academicYear: true, // 🔥 Requerido para validar gestión
      },
    });

    if (!enrollment) throw new NotFoundException('Inscripción no encontrada.');

    // 🔥 BLOQUEO DE ENLACES VIEJOS: No se pueden modificar gestiones históricas
    if (enrollment.academicYear.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Por seguridad, no se permite actualizar datos de una gestión escolar pasada o cerrada.',
      );
    }

    if (enrollment.status === 'RETIRADO' || enrollment.status === 'TRASLADO') {
      throw new BadRequestException(
        'No se pueden actualizar los datos de un estudiante inactivo o trasladado.',
      );
    }

    if (enrollment.rudeUpdateCount >= institution.maxRudeUpdatesPerYear) {
      throw new BadRequestException(
        `Ha superado el límite máximo de ${institution.maxRudeUpdatesPerYear} actualizaciones permitidas por año. Por favor, acérquese a Secretaría.`,
      );
    }

    return enrollment;
  }

  async verifyTokenAndGetData(token: string) {
    let enrollmentId: string;
    try {
      const payload = await this.jwtService.verifyAsync(token);
      enrollmentId = payload.enrollmentId;
    } catch (error) {
      throw new UnauthorizedException(
        'El enlace es inválido o ha expirado por seguridad. Solicite uno nuevo al colegio.',
      );
    }

    const enrollment = await this.validateCampaignAndLimits(enrollmentId);

    const pendingRequest = await this.prisma.dataUpdateRequest.findFirst({
      where: { enrollmentId: enrollmentId, status: 'PENDING' },
    });

    if (pendingRequest) {
      throw new BadRequestException(
        'Sus datos ya fueron enviados y se encuentran en revisión por Secretaría.',
      );
    }

    return {
      message: 'Enlace verificado correctamente',
      data: {
        enrollmentId: enrollment.id,
        enrollmentType: enrollment.enrollmentType,
        rudeCode: enrollment.student.rudeCode,
        student: {
          names: enrollment.student.names,
          lastNamePaterno: enrollment.student.lastNamePaterno,
          lastNameMaterno: enrollment.student.lastNameMaterno,
          ci: enrollment.student.ci,
          documentType: enrollment.student.documentType,
          birthDate: enrollment.student.birthDate,
          gender: enrollment.student.gender,
        },
        guardians: enrollment.student.guardians.map((g) => ({
          relationship: g.relationship,
          ...g.guardian,
        })),
        rudeRecord: enrollment.rudeRecord,
      },
    };
  }

  async submitUpdate(token: string, proposedData: any) {
    let enrollmentId: string;
    try {
      const payload = await this.jwtService.verifyAsync(token);
      enrollmentId = payload.enrollmentId;
    } catch (error) {
      throw new UnauthorizedException('El enlace es inválido o ha expirado.');
    }

    await this.validateCampaignAndLimits(enrollmentId);

    const existingPending = await this.prisma.dataUpdateRequest.findFirst({
      where: { enrollmentId, status: 'PENDING' },
    });

    let requestRecord;
    if (existingPending) {
      requestRecord = await this.prisma.dataUpdateRequest.update({
        where: { id: existingPending.id },
        data: { proposedData },
      });
    } else {
      requestRecord = await this.prisma.dataUpdateRequest.create({
        data: { enrollmentId, proposedData, status: 'PENDING' },
      });
    }

    return {
      message:
        'Sus datos han sido enviados exitosamente y están a la espera de revisión por la Secretaría.',
      requestId: requestRecord.id,
    };
  }

  // ====================================================================
  // 🔒 SECRETARÍA: LISTAR SOLICITUDES PENDIENTES
  // ====================================================================
  async getPendingRequests() {
    return this.prisma.dataUpdateRequest.findMany({
      where: {
        status: 'PENDING',
        // 🔥 FILTRO: Secretaría solo debe ver pendientes del año escolar ACTIVO
        enrollment: { academicYear: { status: 'ACTIVE' } },
      },
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

  // ... (rejectUpdate, approveUpdate, markPhysicalDelivery y delegadores se mantienen idénticos) ...

  async rejectUpdate(requestId: string, reason: string) {
    const request = await this.prisma.dataUpdateRequest.findUnique({
      where: { id: requestId },
      include: { enrollment: true },
    });

    if (!request || request.status !== 'PENDING')
      throw new NotFoundException('La solicitud no existe o ya fue procesada.');

    const updatedRequest = await this.prisma.dataUpdateRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    });

    await this.broadcastService.notifyGuardiansByStudentId(
      request.enrollment.studentId,
      '❌ Formulario RUDE Observado',
      `Su solicitud fue rechazada por Secretaría. Motivo: ${reason}. Por favor, corrija y vuelva a enviar.`,
    );

    return updatedRequest;
  }

  async approveUpdate(requestId: string) {
    const request = await this.prisma.dataUpdateRequest.findUnique({
      where: { id: requestId },
      include: { enrollment: { include: { student: true } } },
    });

    if (!request || request.status !== 'PENDING')
      throw new BadRequestException(
        'La solicitud no existe o ya fue procesada.',
      );
    if (
      request.enrollment.status === 'RETIRADO' ||
      request.enrollment.status === 'TRASLADO'
    ) {
      throw new BadRequestException(
        'No se pueden fusionar datos de un estudiante inactivo.',
      );
    }

    const data: any = request.proposedData;
    await this.transactionService.executeApprovalTransaction(
      requestId,
      request.enrollment.studentId,
      request.enrollmentId,
      data,
    );

    await this.broadcastService.notifyGuardiansByStudentId(
      request.enrollment.studentId,
      '✅ Actualización RUDE Aprobada',
      `Los datos de ${request.enrollment.student.names} han sido verificados y fusionados con el Kardex oficial.`,
    );

    return {
      message: 'Datos del estudiante actualizados y fusionados exitosamente.',
      status: 'APPROVED',
    };
  }

  async markPhysicalDelivery(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) throw new NotFoundException('Inscripción no encontrada.');

    await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { rudeUpdateCount: 99 },
    });

    return {
      message:
        'Entrega física registrada. El tutor ya no recibirá notificaciones.',
    };
  }

  // Delegadores
  async generateUpdateToken(enrollmentId: string) {
    return this.broadcastService.generateUpdateToken(enrollmentId);
  }
  async broadcastUpdateCampaign(enrollmentId: string) {
    return this.broadcastService.broadcastUpdateCampaign(enrollmentId);
  }
  async broadcastToClassroom(classroomId: string) {
    return this.broadcastService.broadcastToClassroom(classroomId);
  }
  async broadcastToAll() {
    return this.broadcastService.broadcastToAll();
  }
  async previewClassroomBroadcast(classroomId: string) {
    return this.broadcastService.previewClassroomBroadcast(classroomId);
  }
}

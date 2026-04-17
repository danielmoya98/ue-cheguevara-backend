import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class DataUpdatesBroadcastService {
  constructor(
    private prisma: PrismaService,
    private firebaseService: FirebaseService,
    private jwtService: JwtService,
  ) {}

  // ====================================================================
  // GENERAR TOKEN SEGURO (Deep Link)
  // ====================================================================
  async generateUpdateToken(enrollmentId: string) {
    return this.jwtService.signAsync(
      { enrollmentId, purpose: 'RUDE_UPDATE' },
      { expiresIn: '7d' },
    );
  }

  // ====================================================================
  // NOTIFICAR A LOS TUTORES DE UN ESTUDIANTE ESPECÍFICO
  // ====================================================================
  async notifyGuardiansByStudentId(studentId: string, title: string, body: string) {
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
      await this.firebaseService
        .sendMulticastNotification(tokensArray, title, body)
        .catch((e) => console.error('Error FCM:', e));
    }
  }

  // ====================================================================
  // CAMPAÑA INDIVIDUAL (Abre el Formulario)
  // ====================================================================
  async broadcastUpdateCampaign(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: {
          include: {
            guardians: { include: { guardian: { include: { user: true } } } },
          },
        },
      },
    });

    if (!enrollment) throw new NotFoundException('Inscripción no encontrada.');

    const fcmTokens = new Set<string>();
    enrollment.student.guardians.forEach((g) => {
      if (g.guardian.user?.fcmTokens) {
        g.guardian.user.fcmTokens.forEach((token) => fcmTokens.add(token));
      }
    });

    const tokensArray = Array.from(fcmTokens);
    if (tokensArray.length === 0) {
      return {
        status: 'FAILED_NO_DEVICES',
        message: 'Ningún tutor tiene la aplicación móvil instalada. Considere usar WhatsApp o Formulario Físico.',
      };
    }

    const token = await this.generateUpdateToken(enrollmentId);
    const publicUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const updateUrl = `${publicUrl}/actualizar-datos/${token}`;

    await this.firebaseService.sendMulticastNotification(
      tokensArray,
      'Actualización de Datos Requerida 🏫',
      `Por favor, actualice el formulario RUDE de ${enrollment.student.names} para la gestión actual.`,
      { updateUrl: updateUrl },
    );

    return {
      status: 'SUCCESS',
      message: 'Notificación Push enviada correctamente a los dispositivos de los tutores.',
    };
  }

  // ====================================================================
  // CAMPAÑA POR CURSO
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

    if (enrollments.length === 0) throw new NotFoundException('No hay estudiantes inscritos en este curso.');

    const fcmTokens = new Set<string>();
    enrollments.forEach((enrollment) => {
      enrollment.student.guardians.forEach((g) => {
        if (g.guardian.user?.fcmTokens) {
          g.guardian.user.fcmTokens.forEach((token) => fcmTokens.add(token));
        }
      });
    });

    const tokensArray = Array.from(fcmTokens);
    if (tokensArray.length === 0) throw new BadRequestException('Ningún tutor de este curso tiene la App instalada.');

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
  // CAMPAÑA MASIVA (NUCLEAR)
  // ====================================================================
  async broadcastToAll() {
    const users = await this.prisma.user.findMany({
      where: {
        role: 'PADRE',
        status: 'ACTIVE',
        fcmTokens: { isEmpty: false },
      },
      select: { fcmTokens: true },
    });

    const fcmTokens = new Set<string>();
    users.forEach((user) => user.fcmTokens.forEach((token) => fcmTokens.add(token)));
    const tokensArray = Array.from(fcmTokens);

    if (tokensArray.length === 0) throw new BadRequestException('No hay dispositivos registrados en el colegio.');

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
  // 🔥 NUEVO: SIMULADOR DE CAMPAÑA POR CURSO (PREVIEW)
  // ====================================================================
  async previewClassroomBroadcast(classroomId: string) {
    const institution = await this.prisma.institution.findFirst();
    const channels = institution?.activeNotificationChannels || [];

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classroomId, status: 'INSCRITO', academicYear: { status: 'ACTIVE' } },
      include: {
        student: { include: { guardians: { include: { guardian: { include: { user: true } } } } } },
      },
    });

    if (enrollments.length === 0) throw new NotFoundException('No hay estudiantes inscritos en este curso.');

    let pushCount = 0;
    let emailCount = 0;
    let whatsappCount = 0;
    let unreachableCount = 0;

    enrollments.forEach((enrollment) => {
      let resolved = false;

      // 1. Simula Push
      if (!resolved && channels.includes('PUSH_APP')) {
        const hasToken = enrollment.student.guardians.some(g => g.guardian.user?.fcmTokens?.length > 0);
        if (hasToken) { pushCount++; resolved = true; }
      }

      // 2. Simula Email
      if (!resolved && channels.includes('EMAIL')) {
        const hasEmail = enrollment.student.guardians.some(g => g.guardian.user?.email || g.guardian.user?.recoveryEmail);
        if (hasEmail) { emailCount++; resolved = true; }
      }

      // 3. Simula WhatsApp
      if (!resolved && channels.includes('WHATSAPP')) {
        const hasPhone = enrollment.student.guardians.some(g => g.guardian.phone);
        if (hasPhone) { whatsappCount++; resolved = true; }
      }

      if (!resolved) unreachableCount++;
    });

    return {
      total: enrollments.length,
      channelsActive: channels,
      projection: { push: pushCount, email: emailCount, whatsapp: whatsappCount, unreachable: unreachableCount }
    };
  }
}
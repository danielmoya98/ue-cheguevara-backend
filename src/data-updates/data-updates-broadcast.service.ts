import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { MailService } from '../mail/mail.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class DataUpdatesBroadcastService {
  constructor(
    private prisma: PrismaService,
    private firebaseService: FirebaseService,
    private mailService: MailService,
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
  // NOTIFICAR A LOS TUTORES DE UN ESTUDIANTE ESPECÍFICO (Silencioso)
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
  // 🔥 EL MOTOR OMNICANAL (Privado)
  // ====================================================================
  private async processOmnichannelBroadcast(enrollment: any, channels: string[]) {
    const studentName = `${enrollment.student.names} ${enrollment.student.lastNamePaterno || ''}`.trim();
    const token = await this.generateUpdateToken(enrollment.id);
    const publicUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const updateUrl = `${publicUrl}/actualizar-datos/${token}`;

    let pushSent = false;
    let emailSent = false;
    // 🔥 TIPADO CORREGIDO
    let whatsappLink: string | null = null;

    // 1. INTENTAR PUSH (Si está activo en el colegio)
    if (channels.includes('PUSH_APP')) {
      const fcmTokens = new Set<string>();
      if (enrollment.student.guardians) {
        enrollment.student.guardians.forEach((g: any) => {
          if (g.guardian.user?.fcmTokens) {
            g.guardian.user.fcmTokens.forEach((t: string) => fcmTokens.add(t));
          }
        });
      }
      
      const tokensArray = Array.from(fcmTokens);
      if (tokensArray.length > 0) {
        await this.firebaseService.sendMulticastNotification(
          tokensArray,
          'Actualización de Datos Requerida 🏫',
          `Por favor, actualice el formulario RUDE de ${studentName}.`,
          { updateUrl: updateUrl },
        ).catch(e => console.error('Error FCM:', e));
        pushSent = true;
      }
    }

    // 2. INTENTAR EMAIL (Si Push falló/no hay tokens Y el Email está activo)
    if (!pushSent && channels.includes('EMAIL')) {
      if (enrollment.student.guardians) {
        for (const g of enrollment.student.guardians) {
          const targetEmail = g.guardian.user?.email || g.guardian.user?.recoveryEmail;
          if (targetEmail) {
            emailSent = await this.mailService.sendRudeUpdateEmail(targetEmail, studentName, updateUrl);
            if (emailSent) break; // Con enviarle a un tutor es suficiente
          }
        }
      }
    }

    // 3. GENERAR WHATSAPP (Si el canal está activo, armamos el link para la secretaria)
    if (channels.includes('WHATSAPP') && !pushSent && !emailSent) {
      // 🔥 TIPADO CORREGIDO
      let targetPhone: string | null = null;
      if (enrollment.student.guardians) {
        const guardianWithPhone = enrollment.student.guardians.find((g: any) => g.guardian.phone);
        targetPhone = guardianWithPhone?.guardian.phone || null;
      }
      
      if (targetPhone) {
        const textMessage = `Hola, el colegio requiere actualizar los datos de *${studentName}*. Por favor, ingresa a este enlace oficial: ${updateUrl}`;
        const cleanPhone = targetPhone.replace(/\D/g, ''); 
        whatsappLink = `https://api.whatsapp.com/send/?phone=591${cleanPhone}&text=${encodeURIComponent(textMessage)}&type=phone_number&app_absent=0`;
      }
    }

    return { enrollmentId: enrollment.id, studentName, pushSent, emailSent, whatsappLink };
  }

  // ====================================================================
  // CAMPAÑA INDIVIDUAL (Abre el Formulario / Omnicanal)
  // ====================================================================
  async broadcastUpdateCampaign(enrollmentId: string) {
    const institution = await this.prisma.institution.findFirst();
    const channels = institution?.activeNotificationChannels || [];

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

    // Usamos la cascada omnicanal
    const result = await this.processOmnichannelBroadcast(enrollment, channels);

    return {
      status: 'SUCCESS',
      message: 'Notificación individual procesada exitosamente.',
      ...result,
    };
  }

  // ====================================================================
  // 🔥 CAMPAÑA POR CURSO
  // ====================================================================
  async broadcastToClassroom(classroomId: string) {
    const institution = await this.prisma.institution.findFirst();
    const channels = institution?.activeNotificationChannels || [];

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

    // 🔥 TIPADO CORREGIDO: Le decimos que es un arreglo de tipo genérico any[]
    const results: any[] = [];
    
    for (const enrollment of enrollments) {
      const result = await this.processOmnichannelBroadcast(enrollment, channels);
      results.push(result);
    }

    const pendingWhatsApp = results.filter((r) => r.whatsappLink !== null);

    return {
      status: 'SUCCESS',
      message: `Campaña procesada. Push/Email enviados automáticamente.`,
      stats: {
        total: enrollments.length,
        pushesSent: results.filter((r) => r.pushSent).length,
        emailsSent: results.filter((r) => r.emailSent).length,
        pendingWhatsApp: pendingWhatsApp,
      },
    };
  }

  // ====================================================================
  // SIMULADOR DE CAMPAÑA POR CURSO (PREVIEW)
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

      if (!resolved && channels.includes('PUSH_APP')) {
        const hasToken = enrollment.student.guardians.some((g: any) => (g.guardian.user?.fcmTokens?.length ?? 0) > 0);
        if (hasToken) { pushCount++; resolved = true; }
      }

      if (!resolved && channels.includes('EMAIL')) {
        const hasEmail = enrollment.student.guardians.some((g: any) => g.guardian.user?.email || g.guardian.user?.recoveryEmail);
        if (hasEmail) { emailCount++; resolved = true; }
      }

      if (!resolved && channels.includes('WHATSAPP')) {
        const hasPhone = enrollment.student.guardians.some((g: any) => g.guardian.phone);
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

  // ====================================================================
  // CAMPAÑA MASIVA (NUCLEAR) - Solo Push por seguridad de SPAM
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
}
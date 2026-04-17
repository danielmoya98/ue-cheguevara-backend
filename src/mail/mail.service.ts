import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private prisma: PrismaService) {
    // Configuración SMTP (Idealmente usa variables de entorno)
    this.transporter = nodemailer.createTransport({
      service: 'gmail', // O el servicio que uses (Outlook, AWS SES)
      auth: {
        user: process.env.SMTP_USER || 'tu_correo_del_colegio@gmail.com',
        pass: process.env.SMTP_PASS || 'tu_password_de_aplicacion',
      },
    });
  }

  async sendRudeUpdateEmail(to: string, studentName: string, updateUrl: string) {
    const institution = await this.prisma.institution.findFirst();
    const senderName = institution?.name || 'Unidad Educativa';

    const mailOptions = {
      from: `"${senderName}" <${process.env.SMTP_USER}>`,
      to: to,
      subject: 'Actualización RUDE Requerida 🏫',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
          <h2 style="color: #004488; text-transform: uppercase;">Actualización de Datos</h2>
          <p>Estimado tutor,</p>
          <p>El colegio requiere que actualice el Formulario RUDE de <strong>${studentName}</strong> para la gestión actual.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${updateUrl}" style="background-color: #004488; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">
              Actualizar Datos Ahora
            </a>
          </div>
          <p style="font-size: 12px; color: #666;">Si el botón no funciona, copie y pegue este enlace en su navegador:</p>
          <p style="font-size: 11px; color: #888; word-break: break-all;">${updateUrl}</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Correo enviado exitosamente a: ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Error enviando correo a ${to}`, error);
      return false;
    }
  }
}
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { Role } from '../../prisma/generated/client';
import { RegisterStudentDto } from './dto/register-student.dto';
import { RegisterGuardianDto } from './dto/register-guardian.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ====================================================================
  // HELPER: GENERADOR DE CORREOS INSTITUCIONALES AUTOMÁTICOS
  // ====================================================================
  private generateInstitutionalEmail(
    names: string,
    lastName: string,
    ci: string | null,
    prefix: string = '',
  ): string {
    const cleanName = names
      .split(' ')[0]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const cleanLastName = lastName
      ? lastName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      : '';
    const ciSuffix = ci ? ci.slice(-3) : '000';

    if (prefix === 'familia') {
      return `familia.${cleanLastName}.${ciSuffix}@uecg.edu.bo`;
    }
    return `${cleanName}.${cleanLastName}.${ciSuffix}@uecg.edu.bo`;
  }

  // ====================================================================
  // LOGIN ESTÁNDAR (WEB Y MÓVIL)
  // ====================================================================
  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('Credenciales incorrectas');

    if (user.status === 'INACTIVE') {
      throw new ForbiddenException('Cuenta desactivada. Contacte a Dirección.');
    }

    if (user.requiresPasswordChange) {
      const setupToken = await this.jwtService.signAsync(
        { sub: user.id, type: 'setup_password' },
        { expiresIn: '15m' },
      );
      return {
        status: 'SETUP_REQUIRED',
        message: 'Debe cambiar su contraseña temporal',
        setupToken: setupToken,
      };
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      status: 'SUCCESS',
      access_token: await this.jwtService.signAsync(payload),
      user: { id: user.id, fullName: user.fullName, role: user.role },
    };
  }

  // ====================================================================
  // CONFIGURACIÓN DE CONTRASEÑA INICIAL (DIRECTORES/DOCENTES)
  // ====================================================================
  async setupNewPassword(setupToken: string, newPasswordRaw: string) {
    let userId: string;

    try {
      const decoded = await this.jwtService.verifyAsync(setupToken);
      if (decoded.type !== 'setup_password') {
        throw new UnauthorizedException(
          'El token no corresponde a esta operación',
        );
      }
      userId = decoded.sub;
    } catch (error) {
      throw new UnauthorizedException(
        'Token de configuración inválido o expirado',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPasswordRaw, salt);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        requiresPasswordChange: false,
      },
    });

    const payload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    };

    return {
      status: 'SUCCESS',
      message: 'Contraseña actualizada correctamente',
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  // ====================================================================
  // REGISTRO APP MÓVIL: PADRES / TUTORES
  // ====================================================================
  async registerGuardian(dto: RegisterGuardianDto) {
    const guardian = await this.prisma.guardian.findUnique({
      where: { ci: dto.ci },
    });

    if (!guardian) {
      throw new NotFoundException(
        'El Carnet de Identidad no está registrado en el colegio. Por favor, actualice sus datos en Secretaría.',
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { guardianId: guardian.id },
    });

    if (existingUser) {
      throw new ConflictException(
        'Ya existe una cuenta asociada a este Carnet de Identidad.',
      );
    }

    const institutionalEmail = this.generateInstitutionalEmail(
      guardian.names,
      guardian.lastNamePaterno || '',
      guardian.ci,
      'familia',
    );

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);
    const fullName =
      `${guardian.names} ${guardian.lastNamePaterno || ''}`.trim();

    const newUser = await this.prisma.user.create({
      data: {
        email: institutionalEmail,
        password: hashedPassword,
        fullName: fullName,
        role: Role.PADRE,
        guardianId: guardian.id,
        recoveryEmail: dto.recoveryEmail, // 🔥 Guardamos el correo de respaldo
        requiresPasswordChange: false,
      },
    });

    const payload = {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };

    return {
      status: 'SUCCESS',
      message: `Cuenta creada exitosamente. Su correo de acceso es: ${institutionalEmail}`,
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        role: newUser.role,
        email: newUser.email,
      },
    };
  }

  // ====================================================================
  // REGISTRO APP MÓVIL: ESTUDIANTES
  // ====================================================================
  async registerStudent(dto: RegisterStudentDto) {
    const startDate = new Date(dto.birthDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const student = await this.prisma.student.findFirst({
      where: {
        ci: dto.ci,
        birthDate: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    if (!student) {
      throw new UnauthorizedException(
        'Los datos proporcionados no coinciden con nuestros registros académicos. Verifique su CI y Fecha de Nacimiento.',
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { studentId: student.id },
    });

    if (existingUser) {
      throw new ConflictException(
        'Ya existe una cuenta activa para este estudiante.',
      );
    }

    const institutionalEmail = this.generateInstitutionalEmail(
      student.names,
      student.lastNamePaterno || '',
      student.ci,
    );

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const newUser = await this.prisma.user.create({
      data: {
        email: institutionalEmail,
        password: hashedPassword,
        fullName: `${student.names} ${student.lastNamePaterno || ''}`.trim(),
        role: Role.ESTUDIANTE,
        studentId: student.id,
        recoveryEmail: dto.recoveryEmail, // 🔥 Guardamos el correo de respaldo
        requiresPasswordChange: false,
      },
    });

    const payload = {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };

    return {
      status: 'SUCCESS',
      message: `Cuenta activada. Tu correo institucional oficial es: ${institutionalEmail}`,
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        role: newUser.role,
        email: newUser.email,
      },
    };
  }

  // ====================================================================
  // RECUPERACIÓN: PASO 1 - ENVIAR CÓDIGO POR CORREO
  // ====================================================================
  async requestPasswordReset(ciOrEmail: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: ciOrEmail },
          { student: { ci: ciOrEmail } },
          { guardian: { ci: ciOrEmail } },
        ],
      },
    });

    if (!user || !user.recoveryEmail) {
      return {
        status: 'SUCCESS',
        message:
          'Si la cuenta existe, se ha enviado un código a su correo de respaldo.',
      };
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetCode, resetCodeExpiresAt: expiresAt },
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'tu_correo_del_colegio@gmail.com', // ⚠️ CAMBIA ESTO
        pass: 'tu_contraseña_de_aplicacion', // ⚠️ CAMBIA ESTO
      },
    });

    const mailOptions = {
      from: '"Colegio Ernesto Che Guevara" <tu_correo_del_colegio@gmail.com>',
      to: user.recoveryEmail,
      subject: 'Código de Recuperación de Contraseña 🔐',
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
          <h2>Recuperación de Acceso</h2>
          <p>Hola ${user.fullName}, solicitaste restablecer tu contraseña.</p>
          <p>Tu código de seguridad de 6 dígitos es:</p>
          <h1 style="color: #004488; letter-spacing: 5px; font-size: 36px;">${resetCode}</h1>
          <p>Este código expirará en 15 minutos.</p>
          <p style="color: gray; font-size: 12px;">Si no solicitaste esto, ignora este correo.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    const [name, domain] = user.recoveryEmail.split('@');
    const maskedEmail = `${name[0]}***${name[name.length - 1]}@${domain}`;

    return {
      status: 'SUCCESS',
      message: `Se ha enviado un código de seguridad a su correo de respaldo: ${maskedEmail}`,
    };
  }

  // ====================================================================
  // RECUPERACIÓN: PASO 2 - VALIDAR CÓDIGO Y CAMBIAR CONTRASEÑA
  // ====================================================================
  async resetPasswordWithCode(
    ciOrEmail: string,
    code: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: ciOrEmail },
          { student: { ci: ciOrEmail } },
          { guardian: { ci: ciOrEmail } },
        ],
      },
    });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    if (user.resetCode !== code) {
      throw new UnauthorizedException('El código ingresado es incorrecto.');
    }
    if (new Date() > (user.resetCodeExpiresAt as Date)) {
      throw new UnauthorizedException(
        'El código ha expirado. Solicite uno nuevo.',
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetCode: null,
        resetCodeExpiresAt: null,
      },
    });

    return {
      status: 'SUCCESS',
      message:
        'Contraseña restablecida correctamente. Ya puede iniciar sesión.',
    };
  }

  // ====================================================================
  // 🔥 CORREGIDO: REGISTRAR EL DISPOSITIVO MÓVIL (FCM TOKEN)
  // ====================================================================
  async registerFcmToken(userId: string, fcmToken: string) {
    if (!userId) {
      throw new ConflictException(
        'El ID de usuario no pudo ser extraído del Token',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const currentTokens = user.fcmTokens || [];

    if (!currentTokens.includes(fcmToken)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          // 🔥 MAGIA ANTI-500: Usamos el operador spread de JS en lugar de 'push' de Prisma.
          // Esto funciona 100% de las veces sin importar si la BD estaba en null.
          fcmTokens: [...currentTokens, fcmToken],
        },
      });
    }

    return {
      status: 'SUCCESS',
      message: 'Dispositivo registrado para recibir notificaciones.',
    };
  }
}

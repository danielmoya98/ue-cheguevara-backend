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
import { RegisterStudentDto } from './dto/register-student.dto';
import { RegisterGuardianDto } from './dto/register-guardian.dto';
import { EncryptionService } from '../common/services/encryption.service'; // 🔥 IMPORTADO

@Injectable()
export class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private encryptionService: EncryptionService, // 🔥 INYECTADO AQUÍ
  ) {}

  // ====================================================================
  // 🔐 1. MOTOR CRIPTOGRÁFICO Y TOKENS (INTACTO)
  // ====================================================================
  async hashPassword(plainText: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plainText, salt);
  }

  async verifyPassword(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }

  private async generateTokens(
    userId: string,
    email: string,
    roleName: string,
    permissions: string[],
  ) {
    const payload = { sub: userId, email, roleName, permissions };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, { expiresIn: '7d' }),
    ]);

    const hashedRefreshToken = await this.hashPassword(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  // ====================================================================
  // 🔥 2. LOGIN Y ROTACIÓN DE TOKENS (INTACTO)
  // ====================================================================
  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    if (!user) throw new UnauthorizedException('Credenciales incorrectas');
    if (user.status === 'INACTIVE')
      throw new ForbiddenException('Cuenta desactivada. Contacte a Dirección.');

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remaining = Math.ceil(
        (user.lockoutUntil.getTime() - new Date().getTime()) / 60000,
      );
      throw new ForbiddenException(
        `Cuenta bloqueada temporalmente. Intente en ${remaining} minutos.`,
      );
    }

    const isMatch = await this.verifyPassword(pass, user.password);

    if (!isMatch) {
      const newAttempts = user.failedLoginAttempts + 1;
      let lockoutDate: Date | null = null;

      if (newAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        lockoutDate = new Date();
        lockoutDate.setMinutes(
          lockoutDate.getMinutes() + this.LOCKOUT_DURATION_MINUTES,
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: newAttempts, lockoutUntil: lockoutDate },
      });

      throw new UnauthorizedException('Credenciales incorrectas');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    if (user.requiresPasswordChange) {
      const setupToken = await this.jwtService.signAsync(
        { sub: user.id, type: 'setup_password' },
        { expiresIn: '15m' },
      );
      return {
        status: 'SETUP_REQUIRED',
        message: 'Debe cambiar su contraseña temporal',
        setupToken,
      };
    }

    const userPermissions =
      user.role?.permissions.map(
        (rp) => `${rp.permission.action}:${rp.permission.subject}`,
      ) || [];
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role?.name || 'GUEST',
      userPermissions,
    );

    return {
      status: 'SUCCESS',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role?.name || 'GUEST',
        permissions: userPermissions,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    let userId: string;
    try {
      const decoded = await this.jwtService.verifyAsync(refreshToken);
      userId = decoded.sub;
    } catch (error) {
      throw new UnauthorizedException(
        'Refresh token expirado o inválido. Inicie sesión nuevamente.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    if (!user || !user.hashedRefreshToken)
      throw new ForbiddenException('Acceso denegado. Sesión inválida.');

    const isRefreshTokenValid = await this.verifyPassword(
      refreshToken,
      user.hashedRefreshToken,
    );
    if (!isRefreshTokenValid)
      throw new ForbiddenException(
        'Acceso denegado. Token revocado o manipulado.',
      );

    const userPermissions =
      user.role?.permissions.map(
        (rp) => `${rp.permission.action}:${rp.permission.subject}`,
      ) || [];
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role?.name || 'GUEST',
      userPermissions,
    );

    return {
      status: 'SUCCESS',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async setupNewPassword(setupToken: string, newPasswordRaw: string) {
    let userId: string;
    try {
      const decoded = await this.jwtService.verifyAsync(setupToken);
      if (decoded.type !== 'setup_password')
        throw new UnauthorizedException('Token no válido');
      userId = decoded.sub;
    } catch {
      throw new UnauthorizedException(
        'Token expirado. Inicie sesión nuevamente.',
      );
    }

    const hashedPassword = await this.hashPassword(newPasswordRaw);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, requiresPasswordChange: false },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    const userPermissions =
      updatedUser.role?.permissions.map(
        (rp) => `${rp.permission.action}:${rp.permission.subject}`,
      ) || [];
    const tokens = await this.generateTokens(
      updatedUser.id,
      updatedUser.email,
      updatedUser.role?.name || 'GUEST',
      userPermissions,
    );

    return {
      status: 'SUCCESS',
      message: 'Contraseña actualizada correctamente',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: updatedUser.id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        role: updatedUser.role?.name,
      },
    };
  }

  // ====================================================================
  // 🛡️ 3. REGISTROS MÓVILES BÚSQUEDA POR ÍNDICE CIEGO (ACTUALIZADO)
  // ====================================================================

  async registerGuardian(dto: RegisterGuardianDto) {
    // 🔥 USAMOS EL ÍNDICE CIEGO PARA BUSCAR EL CARNET
    const ciHash = this.encryptionService.generateBlindIndex(dto.ci);

    const guardian = await this.prisma.guardian.findUnique({
      where: { ciHash: ciHash as string },
    });
    if (!guardian)
      throw new NotFoundException('CI no registrado en el colegio.');

    const existingUser = await this.prisma.user.findFirst({
      where: { guardianId: guardian.id },
    });
    if (existingUser)
      throw new ConflictException('Ya existe una cuenta para este CI.');

    const rolePadre = await this.prisma.role.findUnique({
      where: { name: 'PADRE' },
    });
    if (!rolePadre) throw new NotFoundException('Rol PADRE no configurado.');

    const institutionalEmail = this.generateInstitutionalEmail(
      guardian.names,
      guardian.lastNamePaterno || '',
      dto.ci,
      'familia',
    );
    const hashedPassword = await this.hashPassword(dto.password);

    const newUser = await this.prisma.user.create({
      data: {
        email: institutionalEmail,
        password: hashedPassword,
        fullName: `${guardian.names} ${guardian.lastNamePaterno || ''}`.trim(),
        roleId: rolePadre.id,
        guardianId: guardian.id,
        recoveryEmail: dto.recoveryEmail,
        requiresPasswordChange: false,
      },
    });

    return {
      status: 'SUCCESS',
      message: `Cuenta creada: ${institutionalEmail}`,
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        role: 'PADRE',
        email: newUser.email,
      },
    };
  }

  async registerStudent(dto: RegisterStudentDto) {
    const startDate = new Date(dto.birthDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    // 🔥 USAMOS EL ÍNDICE CIEGO PARA BUSCAR EL CARNET
    const ciHash = this.encryptionService.generateBlindIndex(dto.ci);

    const student = await this.prisma.student.findFirst({
      where: {
        ciHash: ciHash as string,
        birthDate: { gte: startDate, lt: endDate },
      },
    });

    if (!student)
      throw new UnauthorizedException(
        'Los datos proporcionados no coinciden con nuestros registros académicos.',
      );

    const existingUser = await this.prisma.user.findFirst({
      where: { studentId: student.id },
    });
    if (existingUser)
      throw new ConflictException(
        'Ya existe una cuenta activa para este estudiante.',
      );

    const roleStudent = await this.prisma.role.findUnique({
      where: { name: 'ESTUDIANTE' },
    });
    if (!roleStudent)
      throw new NotFoundException(
        'Error crítico: El rol ESTUDIANTE no existe.',
      );

    const institutionalEmail = this.generateInstitutionalEmail(
      student.names,
      student.lastNamePaterno || '',
      dto.ci,
    );
    const hashedPassword = await this.hashPassword(dto.password);

    const newUser = await this.prisma.user.create({
      data: {
        email: institutionalEmail,
        password: hashedPassword,
        fullName: `${student.names} ${student.lastNamePaterno || ''}`.trim(),
        roleId: roleStudent.id,
        studentId: student.id,
        recoveryEmail: dto.recoveryEmail,
        requiresPasswordChange: false,
      },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    const userPermissions =
      newUser.role?.permissions.map(
        (rp) => `${rp.permission.action}:${rp.permission.subject}`,
      ) || [];
    const tokens = await this.generateTokens(
      newUser.id,
      newUser.email,
      newUser.role?.name || 'GUEST',
      userPermissions,
    );

    return {
      status: 'SUCCESS',
      message: `Cuenta activada. Tu correo oficial es: ${institutionalEmail}`,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        role: newUser.role?.name,
        email: newUser.email,
      },
    };
  }

  // ====================================================================
  // 🔑 4. RECUPERACIÓN DE CLAVES (ACTUALIZADO BÚSQUEDA)
  // ====================================================================

  async requestPasswordReset(ciOrEmail: string) {
    const isEmail = ciOrEmail.includes('@');

    // Si no es un correo, generamos el hash asumiendo que ingresó su CI
    const searchHash = !isEmail
      ? this.encryptionService.generateBlindIndex(ciOrEmail)
      : null;

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: ciOrEmail },
          // Solo buscamos por hash si searchHash no es nulo
          ...(searchHash
            ? [
                { student: { ciHash: searchHash } },
                { guardian: { ciHash: searchHash } },
              ]
            : []),
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
        user: 'tu_correo_del_colegio@gmail.com',
        pass: 'tu_contraseña_de_aplicacion',
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
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    const [name, domain] = user.recoveryEmail.split('@');
    return {
      status: 'SUCCESS',
      message: `Se ha enviado un código de seguridad a su correo de respaldo: ${name[0]}***${name[name.length - 1]}@${domain}`,
    };
  }

  async resetPasswordWithCode(
    ciOrEmail: string,
    code: string,
    newPassword: string,
  ) {
    const isEmail = ciOrEmail.includes('@');
    const searchHash = !isEmail
      ? this.encryptionService.generateBlindIndex(ciOrEmail)
      : null;

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: ciOrEmail },
          ...(searchHash
            ? [
                { student: { ciHash: searchHash } },
                { guardian: { ciHash: searchHash } },
              ]
            : []),
        ],
      },
    });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (user.resetCode !== code)
      throw new UnauthorizedException('El código ingresado es incorrecto.');
    if (new Date() > (user.resetCodeExpiresAt as Date))
      throw new UnauthorizedException(
        'El código ha expirado. Solicite uno nuevo.',
      );

    const hashedPassword = await this.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetCode: null,
        resetCodeExpiresAt: null,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    return {
      status: 'SUCCESS',
      message:
        'Contraseña restablecida correctamente. Ya puede iniciar sesión.',
    };
  }

  // ====================================================================
  // DISPOSITIVOS MÓVILES (INTACTO)
  // ====================================================================
  async registerFcmToken(userId: string, fcmToken: string) {
    if (!userId)
      throw new ConflictException(
        'El ID de usuario no pudo ser extraído del Token',
      );
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const currentTokens = user.fcmTokens || [];
    if (!currentTokens.includes(fcmToken)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { fcmTokens: [...currentTokens, fcmToken] },
      });
    }
    return {
      status: 'SUCCESS',
      message: 'Dispositivo registrado para recibir notificaciones.',
    };
  }

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
    return prefix === 'familia'
      ? `familia.${cleanLastName}.${ciSuffix}@uecg.edu.bo`
      : `${cleanName}.${cleanLastName}.${ciSuffix}@uecg.edu.bo`;
  }
}

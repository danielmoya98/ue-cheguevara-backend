import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EncryptionService } from '../common/services/encryption.service'; // 🔥 IMPORTADO

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService, // 🔥 INYECTADO
  ) {}

  // ==========================================
  // HELPER: VALIDACIÓN DE JERARQUÍA ABAC
  // ==========================================
  private validateHierarchy(requestingUser: any, targetUser: any) {
    const reqRole = requestingUser.role; // Viene del JWT/Guard
    const targetRoleName = targetUser.role?.name || targetUser.role;

    // 1. Un Super Admin puede gestionar a todos
    if (reqRole === 'SUPER_ADMIN') return;

    // 2. Si es Director:
    if (reqRole === 'DIRECTOR') {
      // PROHIBIDO: Tocar a un Super Admin u otro Director
      if (['SUPER_ADMIN', 'DIRECTOR'].includes(targetRoleName)) {
        throw new ForbiddenException(
          'Jerarquía insuficiente: Un Director no puede gestionar cuentas de nivel administrativo o iguales.',
        );
      }
      return;
    }

    throw new ForbiddenException(
      'No tienes permisos para realizar acciones administrativas.',
    );
  }

  // ==========================================
  // 1. LÓGICA DE PERFIL PERSONAL
  // ==========================================

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        ci: true,
        phone: true,
        address: true,
        specialty: true,
        // 🔥 1. AHORA SÍ TRAEMOS LOS PERMISOS DESDE LA BASE DE DATOS
        role: {
          select: {
            name: true,
            permissions: {
              select: {
                permission: {
                  select: {
                    action: true,
                    subject: true
                  }
                }
              }
            }
          }
        },
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    // 🔥 2. MAPEAMOS LOS PERMISOS AL FORMATO QUE ENTIENDE EL FRONTEND ("read:own:Student")
    const userPermissions = user.role?.permissions.map(
      (rp) => `${rp.permission.action}:${rp.permission.subject}`
    ) || [];

    // 🔥 3. ENVIAMOS TODO AL FRONTEND
    return {
      ...user,
      role: user.role?.name,
      permissions: userPermissions, // <--- ESTA ES LA PIEZA FALTANTE DEL ROMPECABEZAS
      ci: this.encryptionService.decrypt(user.ci),
      phone: this.encryptionService.decrypt(user.phone),
      address: this.encryptionService.decrypt(user.address),
    };
  }
  async updateProfile(userId: string, data: UpdateProfileDto) {
    const updateData: any = { ...data };

    // 🔥 Encriptamos los datos sensibles entrantes
    if (data.ci) {
      updateData.ci = this.encryptionService.encrypt(data.ci);
      updateData.ciHash = this.encryptionService.generateBlindIndex(data.ci);
    }
    if (data.phone) {
      updateData.phone = this.encryptionService.encrypt(data.phone);
    }
    if (data.address) {
      updateData.address = this.encryptionService.encrypt(data.address);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        ci: true,
        phone: true,
        address: true,
        specialty: true,
        role: { select: { name: true } },
      },
    });

    // 🔥 Desencriptamos la respuesta
    return {
      message: 'Perfil actualizado',
      user: {
        ...updatedUser,
        role: updatedUser.role?.name,
        ci: this.encryptionService.decrypt(updatedUser.ci),
        phone: this.encryptionService.decrypt(updatedUser.phone),
        address: this.encryptionService.decrypt(updatedUser.address),
      },
    };
  }

  async changePassword(userId: string, data: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const isPasswordValid = await bcrypt.compare(
      data.currentPassword,
      user.password,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('La contraseña actual es incorrecta');

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(data.newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  // ==========================================
  // 2. LÓGICA ADMINISTRATIVA (ABAC PROTECTED)
  // ==========================================

  async create(data: any, requestingUser: any) {
    // 🔥 ABAC: El Director no puede crear roles superiores
    if (
      requestingUser.role === 'DIRECTOR' &&
      ['SUPER_ADMIN', 'DIRECTOR'].includes(data.role)
    ) {
      throw new ForbiddenException(
        'No puedes crear usuarios con rangos administrativos.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser)
      throw new ConflictException('El correo ya está registrado');

    const roleRecord = await this.prisma.role.findUnique({
      where: { name: data.role },
    });
    if (!roleRecord)
      throw new BadRequestException(`El rol '${data.role}' no existe.`);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.passwordRaw, salt);

    const newUser = await this.prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        password: hashedPassword,
        roleId: roleRecord.id,
        requiresPasswordChange: true,
      },
      include: { role: true },
    });

    const { password, ...result } = newUser;
    return { ...result, role: result.role?.name };
  }

  async findAll(query: PaginationDto & { role?: string }, requestingUser: any) {
    const { page = 1, limit = 10, search, role } = query;
    const skip = (page - 1) * limit;

    // 🔥 FILTRO ABAC: El Director no puede "ver" que existen Super Admins
    const whereCondition: any = {
      AND: [
        requestingUser.role === 'DIRECTOR'
          ? { role: { name: { not: 'SUPER_ADMIN' } } }
          : {},
        search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        role ? { role: { name: role } } : {},
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where: whereCondition }),
      this.prisma.user.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          lastLoginAt: true,
          role: { select: { name: true } },
        },
      }),
    ]);

    return {
      data: data.map((u) => ({ ...u, role: u.role?.name })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async update(
    id: string,
    data: UpdateUserDto & { role?: string },
    requestingUser: any,
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!targetUser) throw new NotFoundException(`Usuario no encontrado`);

    // 🔥 VALIDACIÓN ABAC
    this.validateHierarchy(requestingUser, targetUser);

    let roleId: string | undefined = undefined;
    if (data.role) {
      if (
        requestingUser.role === 'DIRECTOR' &&
        ['SUPER_ADMIN', 'DIRECTOR'].includes(data.role)
      ) {
        throw new ForbiddenException(
          'No puedes asignar roles administrativos.',
        );
      }
      const roleRecord = await this.prisma.role.findUnique({
        where: { name: data.role },
      });
      roleId = roleRecord?.id;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(roleId !== undefined && { roleId }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        role: { select: { name: true } },
      },
    });

    return {
      message: 'Usuario actualizado',
      user: { ...updatedUser, role: updatedUser.role?.name },
    };
  }

  async remove(id: string, requestingUser: any) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!targetUser) throw new NotFoundException(`Usuario no encontrado`);

    // 🔥 VALIDACIÓN ABAC
    this.validateHierarchy(requestingUser, targetUser);

    await this.prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    return { message: 'Usuario desactivado exitosamente' };
  }

  async reactivate(id: string, requestingUser: any) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!targetUser) throw new NotFoundException(`Usuario no encontrado`);

    this.validateHierarchy(requestingUser, targetUser);

    await this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    return { message: 'Usuario reactivado exitosamente' };
  }

  async resetPassword(id: string, requestingUser: any) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!targetUser) throw new NotFoundException('Usuario no encontrado');

    this.validateHierarchy(requestingUser, targetUser);

    const newRawPassword =
      Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 100);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newRawPassword, salt);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword, requiresPasswordChange: true },
    });

    return {
      message: 'Credenciales restauradas',
      newPassword: newRawPassword,
      fullName: targetUser.fullName,
    };
  }
}

import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role } from '../../prisma/generated/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto'; // <-- Importamos el DTO de Admin

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // 1. LÓGICA DE PERFIL PERSONAL (MI CUENTA)
  // ==========================================

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        ci: true,
        phone: true,
        address: true,
        specialty: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.ci !== undefined && { ci: data.ci }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.specialty !== undefined && { specialty: data.specialty }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        ci: true,
        phone: true,
        address: true,
        specialty: true,
      },
    });

    return { message: 'Perfil actualizado exitosamente', user: updatedUser };
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
  // 2. LÓGICA ADMINISTRATIVA (PANEL ADMIN)
  // ==========================================

  async create(data: {
    fullName: string;
    email: string;
    passwordRaw: string;
    role: Role;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser)
      throw new ConflictException('El correo ya está registrado');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.passwordRaw, salt);

    const newUser = await this.prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        requiresPasswordChange: true, // 🔥 CORRECCIÓN CRÍTICA DE SEGURIDAD
      },
    });

    const { password, ...result } = newUser;
    return result;
  }

  async findAll(query: PaginationDto) {
    // 🔥 CORRECCIÓN: Extraemos el 'role' del query
    const { page = 1, limit = 10, search, sort, role } = query;
    const skip = (page - 1) * limit;

    // 🔥 CORRECCIÓN: Filtro dinámico combinando Búsqueda y Rol
    const whereCondition: any = {
      AND: [
        search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        role ? { role: role } : {}, // Si viene el rol, filtramos en la BD
      ],
    };

    let orderBy = {};
    if (sort) {
      const isDesc = sort.startsWith('-');
      const field = isDesc ? sort.substring(1) : sort;
      orderBy = { [field]: isDesc ? 'desc' : 'asc' };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where: whereCondition }),
      this.prisma.user.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
          lastLoginAt: true,
        },
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // <-- NUEVO: Editar usuario desde Admin
  async update(id: string, data: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user)
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.role !== undefined && { role: data.role }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
      },
    });

    return { message: 'Usuario actualizado exitosamente', user: updatedUser };
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user)
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    await this.prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    return { message: 'Usuario desactivado del sistema exitosamente' };
  }

  // <-- NUEVO: Reactivar usuario desde Admin
  async reactivate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user)
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    await this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    return { message: 'Usuario reactivado exitosamente' };
  }

  async resetPassword(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const newRawPassword =
      Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 100);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newRawPassword, salt);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword, requiresPasswordChange: true },
    });

    return {
      message: 'Credenciales restauradas con éxito',
      newPassword: newRawPassword,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}

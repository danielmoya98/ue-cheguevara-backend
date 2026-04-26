import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        _count: { select: { users: true } },
        permissions: { include: { permission: true } },
      },
      orderBy: { createdAt: 'asc' }, // Para mantener un orden visual lógico
    });
  }

  async getPermissionsCatalog() {
    return this.prisma.permission.findMany({
      orderBy: [{ subject: 'asc' }, { action: 'asc' }],
    });
  }

  async updateRolePermissions(roleId: string, permissionIds: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Rol no encontrado');

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });

      const newPermissions = permissionIds.map((pId) => ({
        roleId,
        permissionId: pId,
      }));

      await tx.rolePermission.createMany({ data: newPermissions });

      return { message: 'Permisos del rol actualizados correctamente' };
    });
  }

  // 🔥 NUEVA LÓGICA: Creación
  async createRole(data: { name: string; description: string }) {
    const safeName = data.name.trim().toUpperCase().replace(/ /g, '_');

    const existingRole = await this.prisma.role.findUnique({
      where: { name: safeName },
    });

    if (existingRole) {
      throw new ConflictException('Ya existe una política con este nombre');
    }

    return this.prisma.role.create({
      data: {
        name: safeName,
        description: data.description,
      },
    });
  }

  // 🔥 NUEVA LÓGICA: Eliminación Protegida
  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!role) throw new NotFoundException('Rol no encontrado');

    // 1. Protección de Roles Core (Hardcoded safety)
    const protectedRoles = ['SUPER_ADMIN', 'DIRECTOR', 'DOCENTE', 'PADRE', 'ESTUDIANTE'];
    if (protectedRoles.includes(role.name)) {
      throw new BadRequestException('No puedes eliminar un rol fundacional del sistema');
    }

    // 2. Protección de Integridad Relacional
    if (role._count.users > 0) {
      throw new BadRequestException(
        `Este rol tiene ${role._count.users} usuarios asignados. Reasígnalos antes de eliminarlo.`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
    return { message: 'Política de acceso eliminada del sistema' };
  }
}
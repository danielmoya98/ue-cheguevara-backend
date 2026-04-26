import { Injectable, NotFoundException } from '@nestjs/common';
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
    });
  }

  async getPermissionsCatalog() {
    return this.prisma.permission.findMany({
      orderBy: [{ subject: 'asc' }, { action: 'asc' }],
    });
  }

  async updateRolePermissions(roleId: string, permissionIds: string[]) {
    // 1. Verificamos que el rol exista
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Rol no encontrado');

    // 2. Transacción para limpiar y reasignar permisos
    return this.prisma.$transaction(async (tx) => {
      // Borramos los permisos actuales del rol
      await tx.rolePermission.deleteMany({ where: { roleId } });

      // Creamos las nuevas relaciones
      const newPermissions = permissionIds.map((pId) => ({
        roleId,
        permissionId: pId,
      }));

      await tx.rolePermission.createMany({
        data: newPermissions,
      });

      return { message: 'Permisos del rol actualizados correctamente' };
    });
  }
}

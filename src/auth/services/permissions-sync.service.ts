import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemPermissions } from '../constants/permissions.constant';

@Injectable()
export class PermissionsSyncService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsSyncService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.sync();
  }

  async sync() {
    this.logger.log('🔄 Sincronizando catálogo de permisos con la DB...');

    // 1. Extraemos los strings y sincronizamos la tabla de permisos
    const permissionStrings = Object.values(SystemPermissions);

    for (const p of permissionStrings) {
      const [action, subject] = p.split(':');

      await this.prisma.permission.upsert({
        where: { action_subject: { action, subject } },
        update: {}, // No cambia nada si ya existe
        create: {
          action,
          subject,
          description: `Permitir ${action} sobre ${subject}`,
        },
      });
    }
    this.logger.log('✅ Catálogo de permisos actualizado.');

    // =========================================================
    // 🔥 SOLUCIÓN A LA PARADOJA DEL PRIMER ADMINISTRADOR
    // =========================================================
    this.logger.log('🛡️ Asegurando privilegios del SUPER_ADMIN...');

    // 2. Garantizamos que el rol SUPER_ADMIN exista (lo crea si no existe)
    const superAdminRole = await this.prisma.role.upsert({
      where: { name: 'SUPER_ADMIN' },
      update: {}, 
      create: {
        name: 'SUPER_ADMIN',
        description: 'Administrador Supremo del Sistema (Root)',
      },
    });

    // 3. Obtenemos TODOS los permisos recién sincronizados
    const allPermissions = await this.prisma.permission.findMany({
      select: { id: true },
    });

    // 4. Mapeamos la data para la tabla intermedia
    const rolePermissionsData = allPermissions.map((p) => ({
      roleId: superAdminRole.id,
      permissionId: p.id,
    }));

    // 5. Transacción: Borramos los permisos viejos del Super Admin y le asignamos TODOS los nuevos
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({
        where: { roleId: superAdminRole.id },
      }),
      this.prisma.rolePermission.createMany({
        data: rolePermissionsData,
      }),
    ]);

    this.logger.log('👑 Privilegios de SUPER_ADMIN garantizados al 100%.');
  }
}
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

    // Extraemos los strings de tu objeto de constantes (ej: "users:create")
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
  }
}

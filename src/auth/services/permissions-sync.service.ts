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
    this.logger.log('🔄 Sincronizando catálogo ABAC de permisos con la DB...');

    // =========================================================
    // 1. SINCRONIZAR CATÁLOGO GLOBAL DE PERMISOS
    // =========================================================
    const permissionStrings = Object.values(SystemPermissions);

    for (const p of permissionStrings) {
      const parts = p.split(':');
      const action = `${parts[0]}:${parts[1]}`;
      const subject = parts[2];

      await this.prisma.permission.upsert({
        where: { action_subject: { action, subject } },
        update: {},
        create: {
          action,
          subject,
          description: `Permitir ${action} sobre ${subject}`,
        },
      });
    }
    this.logger.log('✅ Catálogo de permisos ABAC actualizado.');

    // =========================================================
    // 2. CONFIGURACIÓN DE ROLES FUNDACIONALES (Factory Defaults)
    // =========================================================
    this.logger.log(
      '🛡️ Sembrando roles estructurales y privilegios iniciales...',
    );

    const allDbPermissions = await this.prisma.permission.findMany();

    const getPermIds = (requiredPerms: string[]) => {
      return allDbPermissions
        .filter((dbPerm) =>
          requiredPerms.includes(`${dbPerm.action}:${dbPerm.subject}`),
        )
        .map((p) => p.id);
    };

    const rolesConfig = [
      {
        name: 'SUPER_ADMIN',
        description: 'Administrador Supremo del Sistema (Root)',
        permissionIds: allDbPermissions.map((p) => p.id),
      },
      {
        name: 'DIRECTOR',
        description: 'Máxima Autoridad Pedagógica y Administrativa',
        permissionIds: getPermIds([
          SystemPermissions.MANAGE_ALL_ACADEMIC_YEAR,
          SystemPermissions.READ_ALL_DASHBOARD,
          SystemPermissions.READ_ALL_STUDENT,
          SystemPermissions.UPDATE_ALL_STUDENT,
          SystemPermissions.READ_ALL_ENROLLMENT,
          SystemPermissions.WRITE_ANY_ENROLLMENT,
          SystemPermissions.READ_ALL_ATTENDANCE,
          SystemPermissions.MANAGE_ALL_ATTENDANCE,
          SystemPermissions.READ_ALL_GRADE,
          SystemPermissions.MANAGE_ALL_TIMETABLE,
          SystemPermissions.CREATE_ANY_IDENTITY,
          SystemPermissions.MANAGE_ALL_CLASSROOM,
          SystemPermissions.MANAGE_ALL_SUBJECT,
          SystemPermissions.MANAGE_ALL_TEACHER_ASSIGNMENT,
          SystemPermissions.MANAGE_ALL_PHYSICAL_SPACE,
          SystemPermissions.MANAGE_ALL_USER,
          SystemPermissions.MANAGE_ALL_INSTITUTION,
          SystemPermissions.READ_ALL_AUDIT,
        ]),
      },
      {
        name: 'DOCENTE',
        description: 'Plantel Docente (Acceso web y móvil)',
        permissionIds: getPermIds([
          SystemPermissions.READ_OWN_DASHBOARD,
          SystemPermissions.READ_OWN_STUDENT,
          SystemPermissions.READ_OWN_ENROLLMENT, // 🔥 CAMBIO: Ahora solo ve SUS inscripciones
          SystemPermissions.CREATE_OWN_ATTENDANCE,
          SystemPermissions.UPDATE_OWN_GRADE,
          SystemPermissions.READ_OWN_TIMETABLE,
        ]),
      },
      {
        name: 'PADRE',
        description: 'Padre de Familia o Tutor (App Móvil)',
        permissionIds: getPermIds([SystemPermissions.READ_OWN_GUARDIAN]),
      },
    ];

    // =========================================================
    // 3. EJECUCIÓN (Crear/Actualizar Roles y Asignar Permisos)
    // =========================================================
    for (const config of rolesConfig) {
      const role = await this.prisma.role.upsert({
        where: { name: config.name },
        update: { description: config.description },
        create: {
          name: config.name,
          description: config.description,
        },
      });

      const rolePermissionsData = config.permissionIds.map((pId) => ({
        roleId: role.id,
        permissionId: pId,
      }));

      await this.prisma.$transaction([
        this.prisma.rolePermission.deleteMany({
          where: { roleId: role.id },
        }),
        this.prisma.rolePermission.createMany({
          data: rolePermissionsData,
        }),
      ]);
    }

    this.logger.log(
      '👑 Privilegios de SUPER_ADMIN, DIRECTOR, DOCENTE y PADRE inicializados y blindados.',
    );
  }
}

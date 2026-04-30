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
      // 🔥 NUEVA LÓGICA ABAC: Dividimos "manage:all:PhysicalSpace"
      const parts = p.split(':');
      // action = "manage:all", subject = "PhysicalSpace"
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

    // Obtenemos todos los permisos recién guardados de la base de datos
    const allDbPermissions = await this.prisma.permission.findMany();

    // Helper para buscar los IDs de los permisos según sus códigos exactos
    const getPermIds = (requiredPerms: string[]) => {
      return allDbPermissions
        .filter((dbPerm) =>
          requiredPerms.includes(`${dbPerm.action}:${dbPerm.subject}`),
        )
        .map((p) => p.id);
    };

    // 🔥 NUEVAS RECETAS ABAC
    const rolesConfig = [
      {
        name: 'SUPER_ADMIN',
        description: 'Administrador Supremo del Sistema (Root)',
        // Poder absoluto: Le damos TODOS los IDs de la base de datos
        permissionIds: allDbPermissions.map((p) => p.id),
      },
      {
        name: 'DIRECTOR',
        description: 'Máxima Autoridad Pedagógica y Administrativa',
        // Le damos autonomía casi total, excepto ROOT (MANAGE_ALL) y manipulación de roles pesados
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
        // Solo permisos ":own" y lecturas limitadas a su jurisdicción
        permissionIds: getPermIds([
          SystemPermissions.READ_OWN_DASHBOARD,
          SystemPermissions.READ_OWN_STUDENT,
          SystemPermissions.READ_ALL_ENROLLMENT,
          SystemPermissions.CREATE_OWN_ATTENDANCE,
          SystemPermissions.UPDATE_OWN_GRADE,
          SystemPermissions.READ_OWN_TIMETABLE,
        ]),
      },
      {
        name: 'PADRE',
        description: 'Padre de Familia o Tutor (App Móvil)',
        // Solo lectura estricta de sus propios dependientes
        permissionIds: getPermIds([SystemPermissions.READ_OWN_GUARDIAN]),
      },
    ];

    // =========================================================
    // 3. EJECUCIÓN (Crear/Actualizar Roles y Asignar Permisos)
    // =========================================================
    for (const config of rolesConfig) {
      // 3.1 Garantizamos que el rol exista
      const role = await this.prisma.role.upsert({
        where: { name: config.name },
        update: { description: config.description },
        create: {
          name: config.name,
          description: config.description,
        },
      });

      // 3.2 Preparamos los datos relacionales
      const rolePermissionsData = config.permissionIds.map((pId) => ({
        roleId: role.id,
        permissionId: pId,
      }));

      // 3.3 Transacción: Limpiamos los permisos viejos e insertamos la nueva receta
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

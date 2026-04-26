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

    // =========================================================
    // 1. SINCRONIZAR CATÁLOGO GLOBAL DE PERMISOS
    // =========================================================
    const permissionStrings = Object.values(SystemPermissions);

    for (const p of permissionStrings) {
      const [action, subject] = p.split(':');
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
    this.logger.log('✅ Catálogo de permisos actualizado.');

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

    // Definición de la "Receta" de accesos para cada rol
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
        // Le damos autonomía total, excluyendo borrar el año, borrar matrículas o el manage:all
        permissionIds: getPermIds([
          SystemPermissions.USERS_READ,
          SystemPermissions.USERS_WRITE,
          SystemPermissions.IDENTITY_READ,
          SystemPermissions.IDENTITY_WRITE,
          SystemPermissions.IDENTITY_EXPORT,
          SystemPermissions.INSTITUTION_WRITE,
          SystemPermissions.PHYSICAL_SPACES_WRITE,
          SystemPermissions.ACADEMIC_YEARS_CREATE,
          SystemPermissions.ACADEMIC_YEARS_UPDATE,
          SystemPermissions.TRIMESTERS_WRITE,
          SystemPermissions.CLASS_PERIODS_CREATE,
          SystemPermissions.CLASS_PERIODS_UPDATE,
          SystemPermissions.CLASS_PERIODS_DELETE,
          SystemPermissions.CLASSROOMS_CREATE,
          SystemPermissions.CLASSROOMS_UPDATE,
          SystemPermissions.CLASSROOMS_DELETE,
          SystemPermissions.SUBJECTS_WRITE,
          SystemPermissions.TEACHER_ASSIGNMENTS_READ,
          SystemPermissions.TEACHER_ASSIGNMENTS_WRITE,
          SystemPermissions.TIMETABLES_READ,
          SystemPermissions.TIMETABLES_WRITE,
          SystemPermissions.STUDENTS_WRITE,
          SystemPermissions.ENROLLMENTS_READ,
          SystemPermissions.ENROLLMENTS_WRITE,
          SystemPermissions.GRADES_READ,
          SystemPermissions.GRADES_WRITE,
          SystemPermissions.ATTENDANCE_READ,
          SystemPermissions.ATTENDANCE_WRITE,
          SystemPermissions.ATTENDANCE_JUSTIFY,
          SystemPermissions.RUDE_READ,
          SystemPermissions.RUDE_WRITE,
          SystemPermissions.RUDE_CAMPAIGN,
          SystemPermissions.RUDE_MASSIVE,
        ]),
      },
      {
        name: 'DOCENTE',
        description: 'Plantel Docente (Acceso web y móvil)',
        // Solo lo estrictamente necesario para su trabajo en el aula
        permissionIds: getPermIds([
          SystemPermissions.GRADES_READ,
          SystemPermissions.GRADES_WRITE,
          SystemPermissions.ATTENDANCE_READ,
          SystemPermissions.ATTENDANCE_WRITE,
          SystemPermissions.TIMETABLES_READ,
          SystemPermissions.TEACHER_ASSIGNMENTS_READ,
          SystemPermissions.ENROLLMENTS_READ, // Para que puedan ver la lista de sus alumnos
        ]),
      },
    ];

    // =========================================================
    // 3. EJECUCIÓN (Crear/Actualizar Roles y Asignar Permisos)
    // =========================================================
    for (const config of rolesConfig) {
      // 3.1 Garantizamos que el rol exista
      const role = await this.prisma.role.upsert({
        where: { name: config.name },
        update: {},
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
      '👑 Privilegios de SUPER_ADMIN, DIRECTOR y DOCENTE inicializados.',
    );
  }
}

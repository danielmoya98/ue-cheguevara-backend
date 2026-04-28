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
    const protectedRoles = [
      'SUPER_ADMIN',
      'DIRECTOR',
      'DOCENTE',
      'PADRE',
      'ESTUDIANTE',
    ];
    if (protectedRoles.includes(role.name)) {
      throw new BadRequestException(
        'No puedes eliminar un rol fundacional del sistema',
      );
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

  // ==========================================
  // 🔥 AUTO-SEEDER PARA LA FASE 3 (EJECUTAR UNA VEZ)
  // ==========================================
  async seedMasterPermissions() {
    // 1. Catálogo maestro de permisos (Fase 3 ABAC)
    const permissionsData = [
      // Root / Super Admin
      {
        action: 'manage:all',
        subject: 'all',
        description: 'Acceso absoluto al sistema',
      },

      // Dashboard General
      {
        action: 'read:all',
        subject: 'Dashboard',
        description: 'Ver dashboard global',
      },
      {
        action: 'read:own',
        subject: 'Dashboard',
        description: 'Ver dashboard operativo',
      },

      // Módulos Docentes
      {
        action: 'read:own',
        subject: 'Timetable',
        description: 'Ver su propio horario',
      },
      {
        action: 'create:own',
        subject: 'Attendance',
        description: 'Tomar asistencia de sus clases',
      },
      {
        action: 'update:own',
        subject: 'Grade',
        description: 'Calificar a sus estudiantes',
      },
      {
        action: 'read:own',
        subject: 'Student',
        description: 'Ver solo a sus estudiantes asignados',
      },

      // Módulos Administrativos
      {
        action: 'read:all',
        subject: 'Enrollment',
        description: 'Ver todas las inscripciones',
      },
      {
        action: 'write:any',
        subject: 'Enrollment',
        description: 'Crear y modificar inscripciones',
      },
      {
        action: 'read:all',
        subject: 'Student',
        description: 'Ver todos los estudiantes del colegio',
      },
      {
        action: 'update:all',
        subject: 'Student',
        description: 'Aprobar datos RUDE',
      },
      {
        action: 'create:any',
        subject: 'Identity',
        description: 'Generar Carnets QR',
      },
      {
        action: 'read:all',
        subject: 'Attendance',
        description: 'Ver asistencia global del colegio',
      },
      {
        action: 'read:all',
        subject: 'Grade',
        description: 'Ver sábanas de notas del colegio',
      },

      // Gestión Académica
      {
        action: 'manage:all',
        subject: 'Classroom',
        description: 'Gestionar aulas y paralelos',
      },
      {
        action: 'manage:all',
        subject: 'Subject',
        description: 'Gestionar materias',
      },
      {
        action: 'manage:all',
        subject: 'TeacherAssignment',
        description: 'Asignar carga horaria',
      },
      {
        action: 'manage:all',
        subject: 'Timetable',
        description: 'Armar horarios escolares',
      },
      {
        action: 'manage:all',
        subject: 'PhysicalSpace',
        description: 'Gestionar espacios físicos',
      },

      // Configuración Root
      {
        action: 'manage:all',
        subject: 'User',
        description: 'Gestionar cuentas de usuario',
      },
      {
        action: 'manage:all',
        subject: 'Role',
        description: 'Gestionar roles y permisos',
      },
      {
        action: 'manage:all',
        subject: 'Institution',
        description: 'Configurar RUE y colegio',
      },
      {
        action: 'read:all',
        subject: 'Audit',
        description: 'Ver logs del sistema',
      },
    ];

    // 2. Insertamos todos los permisos evitando duplicados (UPSERT)
    for (const perm of permissionsData) {
      // Usamos el id de acción y subject para asegurarnos de no duplicar
      const existing = await this.prisma.permission.findFirst({
        where: { action: perm.action, subject: perm.subject },
      });

      if (!existing) {
        await this.prisma.permission.create({ data: perm });
      }
    }

    // 3. Obtenemos los roles principales
    const superAdmin = await this.prisma.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
    });
    const director = await this.prisma.role.findUnique({
      where: { name: 'DIRECTOR' },
    });
    const docente = await this.prisma.role.findUnique({
      where: { name: 'DOCENTE' },
    });

    const allPermissions = await this.prisma.permission.findMany();

    // 4. Mapeo de Permisos por Rol
    if (superAdmin) {
      const rootPerm = allPermissions.find(
        (p) => p.action === 'manage:all' && p.subject === 'all',
      );
      if (rootPerm) {
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: superAdmin.id,
              permissionId: rootPerm.id,
            },
          },
          update: {},
          create: { roleId: superAdmin.id, permissionId: rootPerm.id },
        });
      }
    }

    if (director) {
      // El director tiene casi todo, excepto el root
      const directorPerms = allPermissions.filter((p) => p.subject !== 'all');
      for (const perm of directorPerms) {
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: director.id, permissionId: perm.id },
          },
          update: {},
          create: { roleId: director.id, permissionId: perm.id },
        });
      }
    }

    if (docente) {
      // El docente solo tiene permisos "own" y su dashboard
      const docentePerms = allPermissions.filter(
        (p) =>
          (p.action.includes('own') && p.subject !== 'Dashboard') ||
          (p.action === 'read:own' && p.subject === 'Dashboard'),
      );
      for (const perm of docentePerms) {
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: docente.id, permissionId: perm.id },
          },
          update: {},
          create: { roleId: docente.id, permissionId: perm.id },
        });
      }
    }

    return { message: 'Permisos sembrados y asignados exitosamente.' };
  }
}

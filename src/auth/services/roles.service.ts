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

  async seedMasterPermissions() {
    // 1. LIMPIEZA ABSOLUTA (Garantiza que solo exista el estándar oficial)
    await this.prisma.permission.deleteMany({});

    // 2. EL CATÁLOGO OFICIAL (Tu fuente de la verdad)
    const permissionsData = [
      {
        action: 'manage:all',
        subject: 'all',
        description: 'Acceso absoluto al sistema (ROOT)',
      },
      {
        action: 'read:all',
        subject: 'Dashboard',
        description: 'Ver el panel de estadísticas globales',
      },
      {
        action: 'read:own',
        subject: 'Dashboard',
        description: 'Ver el panel operativo personal',
      },
      {
        action: 'read:all',
        subject: 'Student',
        description: 'Ver directorio completo de estudiantes',
      },
      {
        action: 'read:own',
        subject: 'Student',
        description: 'Ver únicamente a sus estudiantes asignados',
      },
      {
        action: 'update:all',
        subject: 'Student',
        description: 'Modificar/Aprobar datos (RUDE) de cualquier estudiante',
      },
      {
        action: 'read:all',
        subject: 'Enrollment',
        description: 'Ver el historial de inscripciones global',
      },
      {
        action: 'write:any',
        subject: 'Enrollment',
        description: 'Inscribir, editar y dar de baja estudiantes',
      },
      {
        action: 'read:all',
        subject: 'Attendance',
        description: 'Ver control de asistencia de todo el colegio',
      },
      {
        action: 'create:own',
        subject: 'Attendance',
        description: 'Tomar asistencia de sus clases asignadas',
      },
      {
        action: 'read:all',
        subject: 'Grade',
        description: 'Ver sábanas de notas de cualquier curso',
      },
      {
        action: 'update:own',
        subject: 'Grade',
        description: 'Calificar únicamente sus materias asignadas',
      },
      {
        action: 'manage:all',
        subject: 'Timetable',
        description: 'Armar y editar horarios escolares generales',
      },
      {
        action: 'read:own',
        subject: 'Timetable',
        description: 'Ver únicamente su propio horario',
      },
      {
        action: 'create:any',
        subject: 'Identity',
        description: 'Generar y revocar Carnets Digitales QR',
      },
      {
        action: 'manage:all',
        subject: 'Classroom',
        description: 'Crear y configurar Cursos y Paralelos',
      },
      {
        action: 'manage:all',
        subject: 'Subject',
        description: 'Gestionar catálogo de Materias',
      },
      {
        action: 'manage:all',
        subject: 'TeacherAssignment',
        description: 'Asignar carga horaria a los docentes',
      },
      {
        action: 'manage:all',
        subject: 'PhysicalSpace',
        description: 'Gestionar aulas, laboratorios y canchas',
      },
      {
        action: 'manage:all',
        subject: 'User',
        description: 'Gestionar cuentas de personal',
      },
      {
        action: 'manage:all',
        subject: 'Role',
        description: 'Crear nuevos roles y asignar permisos',
      },
      {
        action: 'manage:all',
        subject: 'Institution',
        description: 'Configurar RUE, logo y datos del colegio',
      },
      {
        action: 'read:all',
        subject: 'Audit',
        description: 'Ver logs y trazabilidad de los usuarios',
      },
    ];

    // Insertar el catálogo
    await this.prisma.permission.createMany({ data: permissionsData });
    const allPermissions = await this.prisma.permission.findMany();

    // 3. ASIGNACIÓN ESTRICTA DE ROLES BASE
    const superAdmin = await this.prisma.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
    });
    const director = await this.prisma.role.findUnique({
      where: { name: 'DIRECTOR' },
    });
    const docente = await this.prisma.role.findUnique({
      where: { name: 'DOCENTE' },
    });

    // -> SUPER ADMIN: Solo necesita la llave 'manage:all:all'
    if (superAdmin) {
      const rootPerm = allPermissions.find(
        (p) => p.action === 'manage:all' && p.subject === 'all',
      );
      if (rootPerm)
        await this.prisma.rolePermission.create({
          data: { roleId: superAdmin.id, permissionId: rootPerm.id },
        });
    }

    // -> DIRECTOR: Todo lo que es "all" y "any" (Gestión Global), excepto cosas de Root (User, Role, Institution, Audit, all)
    if (director) {
      const directorSubjectsToExclude = [
        'all',
        'User',
        'Role',
        'Institution',
        'Audit',
      ];
      const directorPerms = allPermissions.filter(
        (p) =>
          !directorSubjectsToExclude.includes(p.subject) &&
          !p.action.includes('own'), // No le damos 'own' porque él ve 'all'
      );
      for (const perm of directorPerms) {
        await this.prisma.rolePermission.create({
          data: { roleId: director.id, permissionId: perm.id },
        });
      }
    }

    // -> DOCENTE: Exclusivamente permisos "own" y su Dashboard
    if (docente) {
      const docentePerms = allPermissions.filter(
        (p) =>
          p.action.includes('own') ||
          (p.action === 'read:own' && p.subject === 'Dashboard'),
      );
      for (const perm of docentePerms) {
        await this.prisma.rolePermission.create({
          data: { roleId: docente.id, permissionId: perm.id },
        });
      }
    }

    return { message: 'Estándar Oficial ABAC implementado exitosamente.' };
  }
}

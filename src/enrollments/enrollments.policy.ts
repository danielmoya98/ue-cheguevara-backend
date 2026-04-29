import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';

@Injectable()
export class EnrollmentsPolicy {
  /**
   * Genera el filtro de lectura dinámico según los permisos del usuario.
   */
  getReadScope(user: any): Prisma.EnrollmentWhereInput {
    const permissions = user.permissions || [];

    // 1. Acceso Total (Admin / Director)
    // 🔥 Ahora acepta tanto el permiso de Inscripción como el de Estudiante
    if (
      permissions.includes('manage:all:all') ||
      permissions.includes('read:all:Enrollment') ||
      permissions.includes('read:all:Student')
    ) {
      return {}; // Retorna un filtro vacío (puede ver TODO)
    }

    // 2. Acceso Restringido (Docente)
    // 🔥 Ahora acepta tanto el permiso de Inscripción como el de Estudiante
    if (
      permissions.includes('read:own:Enrollment') ||
      permissions.includes('read:own:Student')
    ) {
      return {
        classroom: {
          subjectAssignments: {
            some: { teacherId: user.userId },
          },
        },
      };
    }

    // 3. Sin acceso
    throw new ForbiddenException(
      'No tienes permisos para ver las inscripciones.',
    );
  }

  /**
   * Valida si un usuario tiene permiso para crear/editar.
   */
  canWrite(user: any): boolean {
    const permissions = user.permissions || [];
    if (
      permissions.includes('manage:all:all') ||
      permissions.includes('write:any:Enrollment') ||
      permissions.includes('update:all:Student')
    ) {
      return true;
    }
    throw new ForbiddenException(
      'Privilegios insuficientes para modificar inscripciones.',
    );
  }
}

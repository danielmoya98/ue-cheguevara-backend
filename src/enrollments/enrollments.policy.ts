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
    if (
      permissions.includes('manage:all:all') ||
      permissions.includes('read:all:Enrollment')
    ) {
      return {}; // Retorna un filtro vacío (puede ver TODO)
    }

    // 2. Acceso Restringido (Docente)
    if (permissions.includes('read:own:Enrollment')) {
      return {
        // 🔥 CORRECCIÓN: En tu schema, la relación se llama "subjectAssignments"
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
      permissions.includes('write:any:Enrollment')
    ) {
      return true;
    }
    throw new ForbiddenException(
      'Privilegios insuficientes para modificar inscripciones.',
    );
  }
}

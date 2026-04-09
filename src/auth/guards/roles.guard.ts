import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../../../prisma/generated/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Leemos qué roles exige esta ruta
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si la ruta no tiene el decorador @Roles, la dejamos pasar (asumiendo que solo requiere estar logueado)
    if (!requiredRoles) {
      return true;
    }

    // 2. Extraemos el usuario de la petición (inyectado por la JwtStrategy)
    const { user } = context.switchToHttp().getRequest();

    // 3. Verificamos si el rol del usuario está dentro de los roles permitidos
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        'No tienes los privilegios necesarios para realizar esta acción',
      );
    }

    return true;
  }
}

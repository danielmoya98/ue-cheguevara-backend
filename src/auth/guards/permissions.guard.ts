import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import {
  PermissionType,
  SystemPermissions,
} from '../constants/permissions.constant';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionType[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // Si la ruta no tiene el decorador, la dejamos pasar (asumimos que solo requiere JWT)
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.permissions) {
      throw new ForbiddenException('No hay permisos asignados a esta sesión');
    }

    // Verificamos si tiene el permiso supremo (ADMIN) o al menos uno de los requeridos
    const hasAccess = requiredPermissions.some(
      (permission) =>
        user.permissions.includes(permission) ||
        user.permissions.includes(SystemPermissions.MANAGE_ALL),
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'No tienes los privilegios necesarios para realizar esta acción',
      );
    }

    return true;
  }
}

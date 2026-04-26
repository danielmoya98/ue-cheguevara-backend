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

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.permissions) {
      throw new ForbiddenException('Sesión sin permisos válidos');
    }

    const hasAccess = requiredPermissions.some(
      (permission) =>
        user.permissions.includes(permission) ||
        user.permissions.includes(SystemPermissions.MANAGE_ALL),
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'Privilegios insuficientes para esta acción',
      );
    }

    return true;
  }
}

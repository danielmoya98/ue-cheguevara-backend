import { SetMetadata } from '@nestjs/common';
import { PermissionType } from '../constants/permissions.constant';

export const PERMISSIONS_KEY = 'permissions';

// Permite exigir uno o varios permisos. Ej: @RequirePermissions(SystemPermissions.GRADES_WRITE)
export const RequirePermissions = (...permissions: PermissionType[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

import { SetMetadata } from '@nestjs/common';
import { Role } from '../../../prisma/generated/client';

export const ROLES_KEY = 'roles';
// Este decorador nos permite poner @Roles(Role.ADMIN) encima de cualquier ruta
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

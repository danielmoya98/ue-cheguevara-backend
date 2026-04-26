import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { RolesService } from '../services/roles.service';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { SystemPermissions } from '../constants/permissions.constant';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(SystemPermissions.MANAGE_ALL)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('permissions-catalog')
  @RequirePermissions(SystemPermissions.MANAGE_ALL)
  getPermissionsCatalog() {
    return this.rolesService.getPermissionsCatalog();
  }

  @Patch(':id/permissions')
  @RequirePermissions(SystemPermissions.MANAGE_ALL)
  updatePermissions(
    @Param('id') id: string,
    @Body('permissionIds') permissionIds: string[],
  ) {
    return this.rolesService.updateRolePermissions(id, permissionIds);
  }

  // 🔥 NUEVO: Crear Rol
  @Post()
  @RequirePermissions(SystemPermissions.MANAGE_ALL)
  createRole(@Body() data: { name: string; description: string }) {
    return this.rolesService.createRole(data);
  }

  // 🔥 NUEVO: Eliminar Rol
  @Delete(':id')
  @RequirePermissions(SystemPermissions.MANAGE_ALL)
  deleteRole(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }
}
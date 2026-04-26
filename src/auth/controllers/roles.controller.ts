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
  @RequirePermissions(SystemPermissions.MANAGE_ALL) // Solo el Super Admin
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
}

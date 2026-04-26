import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SystemPermissions } from '../auth/constants/permissions.constant';

@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions(SystemPermissions.MANAGE_ALL) // Solo Super Admin
  async getLogs(@Query('limit') limit: string = '50') {
    const take = parseInt(limit, 10);
    return this.prisma.auditLog.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            role: { select: { name: true } },
          },
        },
      },
    });
  }
}

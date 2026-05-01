import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto'; // Asegúrate de ajustar la ruta

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // LECTURA DE LOGS PAGINADA
  // ==========================================
  async getLogs(query: PaginationDto) {
    // Valores por defecto seguros
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;
    const search = query.search;

    // Condición de búsqueda opcional (por si decides añadir un input de búsqueda luego)
    const whereCondition = search
      ? {
          OR: [
            { route: { contains: search, mode: 'insensitive' as const } },
            { method: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // 🚀 Transacción paralela para máxima velocidad
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: whereCondition,
        skip,
        take: limit,
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
      }),
      this.prisma.auditLog.count({ where: whereCondition }),
    ]);

    // Retorno estandarizado
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // MANTENIMIENTO AUTOMATIZADO
  // ==========================================
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleLogPurge() {
    this.logger.log('🧹 Iniciando purga de mantenimiento de auditoría...');

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    try {
      const { count } = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: sixMonthsAgo,
          },
        },
      });

      if (count > 0) {
        this.logger.log(
          `✅ Mantenimiento exitoso: ${count} registros antiguos eliminados.`,
        );
      } else {
        this.logger.log(
          `✅ Mantenimiento exitoso: La base de datos está limpia.`,
        );
      }
    } catch (error) {
      this.logger.error('❌ Error crítico al purgar los logs', error);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditCron');

  constructor(private readonly prisma: PrismaService) {}

  // 🔥 Se ejecuta todos los días exactamente a las 3:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleLogPurge() {
    this.logger.log('🧹 Iniciando purga de mantenimiento de auditoría...');

    // Calculamos la fecha límite (Hace exactamente 6 meses)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    try {
      const { count } = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: sixMonthsAgo, // 'lt' significa 'Less Than' (Menor que)
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

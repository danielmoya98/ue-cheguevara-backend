import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  handleCron() {
    this.logger.log('Iniciando limpieza de la carpeta temp-exports...');
    const exportsDir = path.join(process.cwd(), 'temp-exports');

    if (!fs.existsSync(exportsDir)) {
      this.logger.log('La carpeta temp-exports no existe. Todo limpio.');
      return;
    }

    try {
      const files = fs.readdirSync(exportsDir);
      let deletedCount = 0;
      const maxAgeMs = 24 * 60 * 60 * 1000; // 24 horas
      const now = Date.now();

      files.forEach((file) => {
        const filePath = path.join(exportsDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });

      this.logger.log(
        `Limpieza finalizada. Se eliminaron ${deletedCount} archivos ZIP expirados.`,
      );
    } catch (error) {
      this.logger.error('Error al limpiar la carpeta de exportaciones:', error);
    }
  }
}

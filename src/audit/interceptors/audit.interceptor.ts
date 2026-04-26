import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditVigilante');

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const { method, originalUrl, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'Unknown';

    // 1. Filtro de métodos: Solo registramos mutaciones, ignoramos consultas GET
    if (['GET', 'OPTIONS', 'HEAD'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      // 2. Si la acción fue EXITOSA
      tap(async () => {
        const statusCode = response.statusCode;
        await this.logToDatabase(
          request,
          statusCode,
          method,
          originalUrl,
          ip,
          userAgent,
        );
      }),
      // 3. Si la acción produjo un ERROR (ej. 403 Forbidden o 400 Bad Request)
      catchError((err) => {
        const statusCode = err.status || 500;
        this.logToDatabase(
          request,
          statusCode,
          method,
          originalUrl,
          ip,
          userAgent,
        ).catch((e) =>
          this.logger.error('Fallo crítico al guardar log de error', e),
        );
        return throwError(() => err);
      }),
    );
  }

  private async logToDatabase(
    req: any,
    statusCode: number,
    method: string,
    route: string,
    ip: string,
    userAgent: string,
  ) {
    // Si la ruta está protegida, el JwtAuthGuard ya inyectó el usuario aquí
    const userId = req.user?.id || null;

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          method,
          route,
          statusCode,
          ipAddress: ip,
          userAgent,
        },
      });
    } catch (error) {
      this.logger.error('No se pudo escribir en la tabla de auditoría', error);
    }
  }
}

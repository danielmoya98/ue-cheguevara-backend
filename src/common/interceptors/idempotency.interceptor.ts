import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // 1. Buscamos la llave de idempotencia en las cabeceras
    const idempotencyKey = request.headers['x-idempotency-key'];

    // Si la ruta no exige idempotencia o el frontend no la envía, pasa normalmente
    if (!idempotencyKey) {
      return next.handle();
    }

    const cacheKey = `idempotency:${idempotencyKey}`;

    // 2. Buscamos en Redis si esta llave ya fue procesada
    const cachedResponse = await this.cacheManager.get(cacheKey);

    if (cachedResponse) {
      // Si existe, detenemos el flujo hacia la base de datos y devolvemos lo guardado
      // Añadimos una cabecera para que el frontend (o el jurado de tesis) sepa que fue interceptado
      response.setHeader('x-idempotent-replayed', 'true');
      return of(cachedResponse);
    }

    // 3. Si es la primera vez, dejamos que NestJS procese la petición (Controller -> Service -> DB)
    return next.handle().pipe(
      tap(async (data) => {
        // 4. Atrapamos la respuesta exitosa y la guardamos en Redis por 24 horas (86400000 ms)
        // Así, si le dan doble clic o reintentan en las próximas 24h, estarán bloqueados
        await this.cacheManager.set(cacheKey, data, 86400000);
      }),
    );
  }
}

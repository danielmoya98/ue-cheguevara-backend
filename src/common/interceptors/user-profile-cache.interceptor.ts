import { Injectable, ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';

@Injectable()
export class UserProfileCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    // Si no hay usuario en el token, no cacheamos
    if (!userId) {
      return undefined;
    }

    // Creamos una llave única en Redis. Ej: "/users/profile-123e4567..."
    return `${request.url}-${userId}`;
  }
}

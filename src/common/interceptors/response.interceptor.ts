import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseFormat<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ResponseFormat<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseFormat<T>> {
    return next.handle().pipe(
      map((res) => {
        // Si la respuesta ya viene paginada (con meta), la reestructuramos
        if (res?.data && res?.meta) {
          return {
            success: true,
            message: res.message || 'Operación exitosa',
            data: res.data,
            meta: res.meta,
          };
        }
        // Respuesta estándar
        return {
          success: true,
          message: res?.message || 'Operación exitosa',
          data: res?.data !== undefined ? res.data : res,
        };
      }),
    );
  }
}

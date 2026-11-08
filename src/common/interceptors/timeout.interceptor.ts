// src/common/interceptors/timeout.interceptor.ts

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

/**
 * @description Interceptor Global de Tiempo de Espera (Timeout).
 * Aborta forzosamente cualquier request HTTP que supere los 2 minutos (120000ms),
 * evitando encolamientos infinitos y caídas del Event Loop.
 */
@Injectable()
export class TimeOutInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> | Promise<Observable<any>> {
    return next.handle().pipe(timeout(120000)); // 2 minutes
  }
}

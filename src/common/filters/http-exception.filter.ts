// src/common/filters/http-exception.filter.ts

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

/**
 * @description Filtro Global Catch-All para Excepciones HTTP.
 * Captura todos los Crash/Errores (500, 400, 404), formatea la salida
 * de manera predecible para el Frontend y escribe el log de Error en Consola.
 */
@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name);
  /**
   * @description Handler interceptor nativo del Ciclo de Excepciones.
   * Captura el flujo de error, extrae el contexto HTTP y despacha una respuesta
   * JSON uniforme. Garantiza que la propiedad 'error' sea siempre un Objeto.
   */
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extraer la respuesta cruda de la excepción | Extract raw response from exception
    let resContent: any = isHttpException
      ? exception.getResponse()
      : 'Internal system error';

    // Estandarización: Si es un String, lo convertimos a Objeto para no romper el contrato del Frontend
    // pero manteniendo la propiedad 'message' siempre disponible.
    let errorPayload: any;
    if (typeof resContent === 'string') {
      errorPayload = {
        message: resContent,
        statusCode: status,
        error: isHttpException ? exception.name : 'Internal Server Error',
      };
    } else {
      errorPayload = resContent;
    }

    // Logging profesional en consola (No se envía al cliente en su totalidad)
    if (status >= 500) {
      this.logger.error(
        `[CRITICAL] ${request.method} ${request.url} - ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `[EXCEPTION] ${request.method} ${request.url} - Status ${status}: ${JSON.stringify(errorPayload)}`,
      );
    }

    // Despacho final manteniendo la estructura de raíz amigable con axios/frontend
    response.status(status).json({
      time: new Date().toISOString(),
      path: request.url,
      error: errorPayload,
      status: status,
    });
  }
}

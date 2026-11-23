import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { RequestWithId } from './request-context.middleware';

interface JsonResponse { status(code: number): { json(body: unknown): void } }

interface HttpLikeError { statusCode?: unknown; status?: unknown; message?: unknown; name?: unknown; stack?: unknown }

/**
 * Stable API error contract. Nest `HttpException`s (validation, 401/403/404/409/429) keep their
 * existing bodies so actionable messages still reach users. Anything else becomes a generic
 * HTTP 500 (or the status a framework error such as body-parser's 413 already carries) and the
 * real cause is logged server-side with the request ID only. No stack trace ever leaves the process.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<JsonResponse>();
    const request = http.getRequest<RequestWithId>();
    const requestId = request.requestId ?? null;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (status >= 500) this.logServerError(exception, requestId);
      response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    const error = (exception ?? {}) as HttpLikeError;
    const carried = Number(error.statusCode ?? error.status);
    const status = Number.isInteger(carried) && carried >= 400 && carried < 600 ? carried : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) this.logServerError(exception, requestId);
    response.status(status).json({
      statusCode: status,
      error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
      message: status >= 500 ? 'Unexpected server error. Quote the X-Request-Id header when reporting this.' : 'Request could not be processed.',
      requestId,
    });
  }

  private logServerError(exception: unknown, requestId: string | null): void {
    const error = (exception ?? {}) as HttpLikeError;
    this.logger.error(JSON.stringify({
      event: 'unhandled_error',
      requestId,
      name: typeof error.name === 'string' ? error.name : typeof exception,
      message: typeof error.message === 'string' ? error.message : String(exception),
    }), typeof error.stack === 'string' ? error.stack : undefined);
  }
}

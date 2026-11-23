import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { RequestWithId } from './request-context.middleware';

interface JsonResponse { status(code: number): { json(body: unknown): void } }

interface HttpLikeError { statusCode?: unknown; status?: unknown; message?: unknown; name?: unknown; stack?: unknown }

/**
 * Stable API error contract. Expected 4xx HttpExceptions keep actionable validation messages.
 * All 5xx responses use a generic body, including deliberately thrown HttpExceptions. Only
 * error class and safe code are logged with the request ID; no raw error text or stack is logged.
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
      if (status >= 500) {
        this.logServerError(exception, requestId);
        response.status(status).json(this.internalError(status, requestId));
        return;
      }
      response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    const error = (exception ?? {}) as HttpLikeError;
    const carried = Number(error.statusCode ?? error.status);
    const status = Number.isInteger(carried) && carried >= 400 && carried < 600 ? carried : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) this.logServerError(exception, requestId);
    response.status(status).json(status >= 500 ? this.internalError(status, requestId) : {
      statusCode: status,
      error: 'Bad Request',
      message: 'Request could not be processed.',
      requestId,
    });
  }

  private internalError(status: number, requestId: string | null) {
    return { statusCode: status, error: 'Internal Server Error',
      message: 'Unexpected server error. Quote the X-Request-Id header when reporting this.', requestId };
  }

  private logServerError(exception: unknown, requestId: string | null): void {
    const error = (exception ?? {}) as HttpLikeError;
    this.logger.error(JSON.stringify({
      event: 'unhandled_error',
      requestId,
      name: typeof error.name === 'string' ? error.name : typeof exception,
      code: typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : undefined,
    }));
  }
}

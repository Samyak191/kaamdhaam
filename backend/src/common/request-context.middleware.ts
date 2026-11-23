import { randomUUID } from 'node:crypto';

/** Minimal structural view of the Express request; avoids a types-only dependency. */
export interface RequestWithId {
  method: string;
  route?: { path?: string };
  requestId?: string;
}
export interface ResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: 'finish', callback: () => void): void;
}

/**
 * Assigns a server-generated request ID, exposes it as `X-Request-Id`, and writes one
 * structured JSON access-log line per response. The line intentionally omits headers,
 * query strings, bodies and identities so tokens and private content never reach logs.
 */
export function requestContextMiddleware(request: RequestWithId, response: ResponseLike, next: () => void): void {
  const requestId = randomUUID();
  const started = process.hrtime.bigint();
  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  response.setHeader('Cache-Control', 'no-store');
  response.on('finish', () => {
    const status = response.statusCode;
    process.stdout.write(`${JSON.stringify({
      timestamp: new Date().toISOString(),
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      event: 'http_request',
      requestId,
      method: request.method,
      route: request.route?.path ?? '<unmatched>',
      status,
      durationMs: Number(process.hrtime.bigint() - started) / 1e6,
    })}
`);
  });
  next();
}

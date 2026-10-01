import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from '../request-context';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;
const logger = new Logger('HTTP');

/**
 * Express middleware (installed with app.use before everything else):
 * assigns a request id (echoed in `x-request-id` and in every error body), establishes the
 * AsyncLocalStorage context and writes one access-log line per request.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', requestId);

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0];
    if (path.endsWith('/health') || path.startsWith('/uploads/')) return;
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const line = `${req.method} ${path} ${res.statusCode} ${ms.toFixed(1)}ms [${requestId.slice(0, 8)}]`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });

  RequestContext.run(
    { requestId, ip: req.ip, userAgent: req.header('user-agent')?.slice(0, 255) },
    next,
  );
}

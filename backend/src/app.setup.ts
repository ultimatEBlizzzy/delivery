import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { API_PREFIX } from '@hardware-delivery/shared';
import {
  AllExceptionsFilter,
  validationExceptionFactory,
} from './common/filters/all-exceptions.filter';
import { requestContextMiddleware } from './common/middleware/request-context.middleware';
import { TypedConfigService } from './config';

/**
 * Applies all HTTP-level configuration. Shared by main.ts and the e2e test harness so tests run
 * against exactly the same pipeline (prefix, validation, filters, security headers) as production.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService) as TypedConfigService;
  const allowedOrigins = config.get('corsOrigins', { infer: true });
  const uploadDir = resolve(config.get('storage', { infer: true }).uploadDir);

  app.set('trust proxy', config.get('trustProxy', { infer: true }));
  app.disable('x-powered-by');

  app.use(requestContextMiddleware);
  app.use(
    helmet({
      // Product/store images are embedded by the SPA, which may be served from another origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Requests without an Origin header (curl, server-to-server, same-origin) are not CORS requests.
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Auth-Mode',
      'X-Request-Id',
      'X-Store-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  app.setGlobalPrefix(API_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties…
      forbidNonWhitelisted: true, // …and reject them: clients cannot smuggle price/total/status fields
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  // Public uploads (product images, logos). Private files (documents, proofs) are never served statically.
  const publicDir = join(uploadDir, 'public');
  mkdirSync(publicDir, { recursive: true });
  app.useStaticAssets(publicDir, {
    prefix: '/uploads/',
    index: false,
    maxAge: '7d',
    // Even if a file were opened directly, it can run no script and load no subresources.
    setHeaders: (res) =>
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      ),
  });
}

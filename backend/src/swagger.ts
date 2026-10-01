import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@hardware-delivery/shared';

/** OpenAPI document at /api/docs (UI) and /api/docs-json (machine readable). */
export function setupSwagger(app: NestExpressApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Hardware Delivery API')
      .setDescription(
        'REST API for the South African hardware e-hailing & delivery marketplace: customers, hardware ' +
          'stores, drivers and administrators.\n\nAuthenticate with `POST /auth/login`, then click ' +
          '**Authorize** and paste the `accessToken`.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addServer(`/${API_PREFIX}`)
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha', operationsSorter: 'alpha' },
  });
}

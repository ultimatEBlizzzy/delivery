import 'reflect-metadata';
import './database/pg-types';
import { Logger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { ConfigError, TypedConfigService } from './config';
import { setupSwagger } from './swagger';

const LOG_LEVELS: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

async function bootstrap(): Promise<void> {
  const configured = (process.env.LOG_LEVEL ?? 'log').toLowerCase() as LogLevel;
  const level = LOG_LEVELS.includes(configured) ? configured : 'log';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: LOG_LEVELS.slice(0, LOG_LEVELS.indexOf(level) + 1),
  });
  configureApp(app);

  const config = app.get(ConfigService) as TypedConfigService;
  if (config.get('swagger', { infer: true }).enabled) setupSwagger(app);

  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  const logger = new Logger('Bootstrap');
  logger.log(
    `API listening on http://0.0.0.0:${port}/api/v1 (${config.get('env', { infer: true })})`,
  );
  if (config.get('swagger', { infer: true }).enabled)
    logger.log(`Swagger UI: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err: unknown) => {
  if (err instanceof ConfigError) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});

import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

export interface TestContext {
  app: NestExpressApplication;
  http: ReturnType<typeof request>;
  dataSource: DataSource;
  close: () => Promise<void>;
}

/**
 * Boots the complete application (same pipeline as production) against the test database.
 * `env` overrides apply only while the app initialises (config is read at module init).
 */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestContext> {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    return {
      app,
      http: request(app.getHttpServer()),
      dataSource: app.get(DataSource),
      close: () => app.close(),
    };
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

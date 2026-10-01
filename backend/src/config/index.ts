import { ConfigService } from '@nestjs/config';
import { AppConfig } from './configuration';

export * from './configuration';
export * from './load-env';

/** Typed ConfigService alias used across the app. */
export type TypedConfigService = ConfigService<AppConfig, true>;

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { STRICT_THROTTLE_KEY } from './common/decorators/strict-throttle.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppConfig, ENV_FILE_PATHS, loadConfig } from './config';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogueModule } from './modules/catalogue/catalogue.module';
import { GeoModule } from './modules/geo/geo.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MapsModule } from './modules/maps/maps.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StorageModule } from './modules/storage/storage.module';
import { StoresModule } from './modules/stores/stores.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
      // Validates the whole environment at boot and fails fast with a readable list of problems.
      validate: (raw) => {
        loadConfig(raw as Record<string, string | undefined>);
        return raw;
      },
      load: [() => loadConfig(process.env) as unknown as Record<string, unknown>],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const rl = config.get('rateLimit', { infer: true });
        const reflector = new Reflector();
        return {
          throttlers: [
            { name: 'default', ttl: rl.ttlMs, limit: rl.limit },
            {
              // Extra-strict limit, only for routes marked with @StrictThrottle() (login, register).
              name: 'strict',
              ttl: rl.ttlMs,
              limit: rl.authLimit,
              // A throttler's own skipIf REPLACES the global one, so the enabled flag is repeated here.
              skipIf: (ctx) =>
                !rl.enabled ||
                !reflector.getAllAndOverride<boolean>(STRICT_THROTTLE_KEY, [
                  ctx.getHandler(),
                  ctx.getClass(),
                ]),
            },
          ],
          skipIf: () => !rl.enabled,
        };
      },
    }),
    DatabaseModule,
    AuditModule,
    SettingsModule,
    UsersModule,
    AuthModule,
    StorageModule,
    GeoModule,
    MapsModule,
    InventoryModule,
    CatalogueModule,
    StoresModule,
    HealthModule,
  ],
  providers: [
    // Order matters: throttle first, then authenticate, then authorise by role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

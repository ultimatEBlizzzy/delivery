import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';
import { MAPS_PROVIDER, MapsProvider } from './maps.types';
import { MockMapsProvider } from './providers/mock-maps.provider';

/**
 * Provider selection is driven by MAPS_PROVIDER. To add Google Maps: implement MapsProvider,
 * add it to `providers`, and return it from the factory for `case 'google'`.
 */
@Global()
@Module({
  controllers: [MapsController],
  providers: [
    MockMapsProvider,
    {
      provide: MAPS_PROVIDER,
      inject: [ConfigService, MockMapsProvider],
      useFactory: (
        config: ConfigService<AppConfig, true>,
        mock: MockMapsProvider,
      ): MapsProvider => {
        const choice = config.get('providers', { infer: true }).maps;
        switch (choice) {
          case 'mock':
            return mock;
          default:
            throw new Error(`Unsupported MAPS_PROVIDER "${choice}"`);
        }
      },
    },
    MapsService,
  ],
  exports: [MapsService],
})
export class MapsModule {}

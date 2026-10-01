import { Inject, Injectable } from '@nestjs/common';
import { VehicleType } from '@hardware-delivery/shared';
import {
  DistanceResult,
  GeocodeResult,
  LatLng,
  MAPS_PROVIDER,
  MapsProvider,
  RouteResult,
} from './maps.types';

const GEOCODE_CACHE_MAX = 500;

/**
 * The only maps API the rest of the application uses. Adds caching and input hygiene on top of
 * whichever provider is configured (see MapsModule).
 */
@Injectable()
export class MapsService {
  private readonly geocodeCache = new Map<string, GeocodeResult | null>();

  constructor(@Inject(MAPS_PROVIDER) private readonly provider: MapsProvider) {}

  get providerName(): string {
    return this.provider.name;
  }

  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    const key = address.trim().toLowerCase().replace(/\s+/g, ' ');
    if (this.geocodeCache.has(key)) return this.geocodeCache.get(key)!;
    const result = await this.provider.geocodeAddress(key);
    if (this.geocodeCache.size >= GEOCODE_CACHE_MAX) {
      this.geocodeCache.delete(this.geocodeCache.keys().next().value as string);
    }
    this.geocodeCache.set(key, result);
    return result;
  }

  calculateDistance(origin: LatLng, destination: LatLng): Promise<DistanceResult> {
    return this.provider.calculateDistance(origin, destination);
  }

  calculateRoute(origin: LatLng, destination: LatLng): Promise<RouteResult> {
    return this.provider.calculateRoute(origin, destination);
  }

  /** Estimated minutes of driving for a given vehicle type. */
  estimateTravelTime(
    origin: LatLng,
    destination: LatLng,
    vehicleType?: VehicleType,
  ): Promise<number> {
    return this.provider.estimateTravelTime(origin, destination, vehicleType);
  }
}

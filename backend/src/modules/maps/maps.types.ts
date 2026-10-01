import { VehicleType } from '@hardware-delivery/shared';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  /** 0..1 */
  confidence: number;
  suburb?: string;
  city?: string;
  province?: string;
}

export interface DistanceResult {
  /** Road distance in kilometres. */
  distanceKm: number;
  durationMin: number;
}

export interface RouteResult extends DistanceResult {
  /** Ordered [lat, lng] points describing the route, for drawing on a map. */
  polyline: Array<[number, number]>;
}

/**
 * The contract every maps backend implements. Business code depends on this interface only
 * (through MapsService), so Google Maps / Mapbox / OSRM can be plugged in without touching it.
 */
export interface MapsProvider {
  readonly name: string;
  geocodeAddress(address: string): Promise<GeocodeResult | null>;
  calculateDistance(origin: LatLng, destination: LatLng): Promise<DistanceResult>;
  calculateRoute(origin: LatLng, destination: LatLng): Promise<RouteResult>;
  estimateTravelTime(
    origin: LatLng,
    destination: LatLng,
    vehicleType?: VehicleType,
  ): Promise<number>;
}

export const MAPS_PROVIDER = 'MAPS_PROVIDER';

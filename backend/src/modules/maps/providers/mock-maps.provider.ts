import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { haversineKm, VehicleType } from '@hardware-delivery/shared';
import { DistanceResult, GeocodeResult, LatLng, MapsProvider, RouteResult } from '../maps.types';
import { PLACES, Place } from './south-africa-places';

/** Straight-line distance is multiplied by this to approximate road distance. */
const ROAD_FACTOR = 1.3;
const ROUTE_POINTS = 28;

/** Average real-world speeds (km/h) including town driving and stops. */
const SPEED_KMH: Record<VehicleType, number> = {
  [VehicleType.MOTORCYCLE]: 50,
  [VehicleType.CAR]: 50,
  [VehicleType.BAKKIE]: 45,
  [VehicleType.PANEL_VAN]: 42,
  [VehicleType.TRUCK]: 38,
};
const DEFAULT_SPEED_KMH = 45;

const COORDINATES = /(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)/;

/** Deterministic pseudo-random number in [0,1) derived from text, so the same input always maps to the same point. */
function seeded(text: string, salt: string): number {
  const digest = createHash('sha1').update(`${salt}:${text}`).digest();
  return digest.readUInt32BE(0) / 0x1_0000_0000;
}

/**
 * Offline maps implementation used until a real provider is configured: a gazetteer geocoder,
 * haversine × road-factor distances, a gently curved route polyline and speed-based ETAs.
 * Deterministic, free, and good enough to develop and demo the whole delivery flow.
 */
@Injectable()
export class MockMapsProvider implements MapsProvider {
  readonly name = 'mock';

  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    const text = address.trim();
    if (!text) return null;

    // 1) "-23.0167, 30.6781" style input is taken literally.
    const literal = COORDINATES.exec(text);
    if (literal) {
      const lat = Number(literal[1]);
      const lng = Number(literal[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return {
          lat,
          lng,
          formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          confidence: 1,
        };
      }
    }

    // 2) Find the best (longest) town name mentioned in the text.
    const lower = text.toLowerCase();
    let best: { place: Place; length: number } | null = null;
    for (const place of PLACES) {
      for (const name of [place.name, ...(place.aliases ?? [])]) {
        if (lower.includes(name.toLowerCase()) && (!best || name.length > best.length)) {
          best = { place, length: name.length };
        }
      }
    }
    if (!best) return null;

    // 3) Spread different street addresses a little (±~1.5 km) around the town centre.
    const { place } = best;
    const jitter = (salt: string) => (seeded(lower, salt) - 0.5) * 0.03;
    const lat = Number((place.lat + jitter('lat')).toFixed(6));
    const lng = Number((place.lng + jitter('lng')).toFixed(6));
    const parts = text
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const street = parts[0]?.toLowerCase().includes(place.name.toLowerCase()) ? null : parts[0];
    const formattedAddress = [street, place.name, place.province, 'South Africa']
      .filter(Boolean)
      .join(', ');
    return {
      lat,
      lng,
      formattedAddress,
      confidence: street ? 0.7 : 0.5,
      suburb: parts.length > 2 ? parts[1] : undefined,
      city: place.name,
      province: place.province,
    };
  }

  async calculateDistance(origin: LatLng, destination: LatLng): Promise<DistanceResult> {
    const distanceKm = Number((haversineKm(origin, destination) * ROAD_FACTOR).toFixed(2));
    return {
      distanceKm,
      durationMin: Math.max(1, Math.round((distanceKm / DEFAULT_SPEED_KMH) * 60)),
    };
  }

  async calculateRoute(origin: LatLng, destination: LatLng): Promise<RouteResult> {
    const { distanceKm, durationMin } = await this.calculateDistance(origin, destination);
    // Quadratic Bézier with the control point pushed sideways so the line looks like a road, not a ruler.
    const mid = {
      lat: (origin.lat + destination.lat) / 2,
      lng: (origin.lng + destination.lng) / 2,
    };
    const dLat = destination.lat - origin.lat;
    const dLng = destination.lng - origin.lng;
    const bend = 0.12;
    const control = { lat: mid.lat - dLng * bend, lng: mid.lng + dLat * bend };
    const polyline: Array<[number, number]> = [];
    for (let i = 0; i <= ROUTE_POINTS; i++) {
      const t = i / ROUTE_POINTS;
      const a = (1 - t) ** 2;
      const b = 2 * (1 - t) * t;
      const c = t ** 2;
      polyline.push([
        Number((a * origin.lat + b * control.lat + c * destination.lat).toFixed(6)),
        Number((a * origin.lng + b * control.lng + c * destination.lng).toFixed(6)),
      ]);
    }
    return { distanceKm, durationMin, polyline };
  }

  async estimateTravelTime(
    origin: LatLng,
    destination: LatLng,
    vehicleType?: VehicleType,
  ): Promise<number> {
    const { distanceKm } = await this.calculateDistance(origin, destination);
    const speed = vehicleType ? SPEED_KMH[vehicleType] : DEFAULT_SPEED_KMH;
    return Math.max(1, Math.round((distanceKm / speed) * 60));
  }
}

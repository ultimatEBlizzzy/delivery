import type { Point } from 'geojson';

/** GeoJSON stores coordinates as [longitude, latitude]. These helpers keep that order in one place. */
export function toPoint(lat: number, lng: number): Point {
  return { type: 'Point', coordinates: [lng, lat] };
}

export function pointToLatLng(point: Point): { lat: number; lng: number } {
  return { lat: point.coordinates[1], lng: point.coordinates[0] };
}

/** SQL fragment that builds a geography point from named parameters (:lng, :lat). */
export const SQL_POINT = 'ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography';

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function isValidGeoPoint(p: unknown): p is GeoPoint {
  if (!p || typeof p !== 'object') return false;
  const { lat, lng } = p as Partial<GeoPoint>;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Default map centre (Malamulele, Limpopo) used when no location is known. */
export const DEFAULT_MAP_CENTER: GeoPoint = { lat: -23.0167, lng: 30.6781 };

/** Deep-link URLs for turn-by-turn navigation. They need no API key. */
export function googleMapsDirectionsUrl(to: GeoPoint, from?: GeoPoint): string {
  const parts = [
    'api=1',
    `destination=${encodeURIComponent(`${to.lat},${to.lng}`)}`,
    'travelmode=driving',
  ];
  if (from) parts.push(`origin=${encodeURIComponent(`${from.lat},${from.lng}`)}`);
  return `https://www.google.com/maps/dir/?${parts.join('&')}`;
}

export function wazeNavigateUrl(to: GeoPoint): string {
  return `https://waze.com/ul?ll=${to.lat},${to.lng}&navigate=yes`;
}

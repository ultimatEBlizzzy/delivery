import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Home, MapPin, Store, Truck, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { DEFAULT_MAP_CENTER } from '@hardware-delivery/shared';
import { env } from '@/env';

export type MarkerKind = 'store' | 'customer' | 'driver' | 'pin';

export interface MapMarker {
  id: string;
  position: [number, number];
  kind: MarkerKind;
  label?: string;
  popup?: ReactNode;
  draggable?: boolean;
}

export interface MapViewProps {
  markers?: MapMarker[];
  /** Ordered [lat, lng] points, e.g. a delivery route. */
  route?: Array<[number, number]>;
  routeColor?: string;
  center?: [number, number];
  zoom?: number;
  /** Re-fit the viewport to the markers/route whenever they change. */
  fit?: boolean;
  height?: number | string;
  className?: string;
  ariaLabel?: string;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerDrag?: (id: string, lat: number, lng: number) => void;
}

const COLORS: Record<MarkerKind, string> = {
  store: '#ea580c',
  customer: '#2563eb',
  driver: '#16a34a',
  pin: '#dc2626',
};
const ICONS: Record<MarkerKind, LucideIcon> = {
  store: Store,
  customer: Home,
  driver: Truck,
  pin: MapPin,
};
const iconCache = new Map<string, L.DivIcon>();

function markerIcon(kind: MarkerKind): L.DivIcon {
  const cached = iconCache.get(kind);
  if (cached) return cached;
  const Icon = ICONS[kind];
  const svg = renderToStaticMarkup(<Icon size={16} color="#fff" strokeWidth={2.4} />);
  const round = kind === 'driver';
  const html = round
    ? `<div style="width:38px;height:38px;border-radius:50%;background:${COLORS[kind]};display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)">${svg}</div>`
    : `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;background:${COLORS[kind]};transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"><div style="transform:rotate(45deg);display:flex">${svg}</div></div>`;
  const icon = L.divIcon({
    className: 'map-pin',
    html,
    iconSize: round ? [38, 38] : [34, 34],
    iconAnchor: round ? [19, 19] : [17, 34],
    popupAnchor: [0, round ? -20 : -32],
  });
  iconCache.set(kind, icon);
  return icon;
}

function FitToContent({
  markers,
  route,
}: {
  markers: MapMarker[];
  route?: Array<[number, number]>;
}) {
  const map = useMap();
  const key = JSON.stringify([
    markers.map((m) => m.position),
    route?.length ? [route[0], route[route.length - 1]] : null,
  ]);
  useEffect(() => {
    const points: Array<[number, number]> = [...markers.map((m) => m.position), ...(route ?? [])];
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], Math.max(map.getZoom(), 14));
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the geometry changes
  }, [key, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Leaflet map with themed markers, an optional route polyline, click and drag support. */
export default function MapView({
  markers = [],
  route,
  routeColor = '#ea580c',
  center,
  zoom = 12,
  fit = true,
  height = 320,
  className,
  ariaLabel = 'Map',
  onMapClick,
  onMarkerDrag,
}: MapViewProps) {
  const start = useMemo<[number, number]>(
    () => center ?? markers[0]?.position ?? [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial centre only
    [],
  );
  return (
    <div
      className={className}
      style={{ height, width: '100%', borderRadius: 'inherit', overflow: 'hidden' }}
      role="region"
      aria-label={ariaLabel}
    >
      <MapContainer
        center={start}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={env.mapTileUrl} attribution={env.mapAttribution} maxZoom={19} />
        {route && route.length > 1 && (
          <Polyline
            positions={route}
            pathOptions={{ color: routeColor, weight: 5, opacity: 0.85 }}
          />
        )}
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={m.position}
            icon={markerIcon(m.kind)}
            draggable={m.draggable}
            title={m.label}
            eventHandlers={
              m.draggable && onMarkerDrag
                ? {
                    dragend: (e) => {
                      const { lat, lng } = (e.target as L.Marker).getLatLng();
                      onMarkerDrag(m.id, lat, lng);
                    },
                  }
                : undefined
            }
          >
            {(m.popup || m.label) && <Popup>{m.popup ?? m.label}</Popup>}
          </Marker>
        ))}
        {fit && <FitToContent markers={markers} route={route} />}
        {onMapClick && <ClickHandler onClick={onMapClick} />}
      </MapContainer>
    </div>
  );
}

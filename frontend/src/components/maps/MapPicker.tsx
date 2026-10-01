import { LazyMap } from './LazyMap';

/** Click the map or drag the pin to choose a location. */
export function MapPicker({
  value,
  onChange,
  height = 260,
  kind = 'store',
}: {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
  kind?: 'store' | 'customer' | 'pin';
}) {
  const round = (n: number) => Number(n.toFixed(6));
  return (
    <div className="overflow-hidden rounded-xl border border-slate-300">
      <LazyMap
        height={height}
        ariaLabel="Pick a location on the map"
        fit={false}
        center={value ? [value.lat, value.lng] : undefined}
        zoom={value ? 14 : 7}
        markers={
          value
            ? [
                {
                  id: 'pin',
                  kind,
                  position: [value.lat, value.lng],
                  draggable: true,
                  label: 'Drag me',
                },
              ]
            : []
        }
        onMapClick={(lat, lng) => onChange(round(lat), round(lng))}
        onMarkerDrag={(_id, lat, lng) => onChange(round(lat), round(lng))}
      />
      <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
        {value
          ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} – click the map or drag the pin to adjust.`
          : 'Click the map to drop a pin.'}
      </p>
    </div>
  );
}

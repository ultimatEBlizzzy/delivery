import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/Feedback';
import type { MapViewProps } from './MapView';

const MapView = lazy(() => import('./MapView'));

/** Loads Leaflet on demand so it never weighs down pages without a map. */
export function LazyMap(props: MapViewProps) {
  return (
    <Suspense fallback={<Skeleton className="w-full" style={{ height: props.height ?? 320 }} />}>
      <MapView {...props} />
    </Suspense>
  );
}

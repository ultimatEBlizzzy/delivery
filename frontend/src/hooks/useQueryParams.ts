import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type Primitive = string | number | boolean | undefined;

/**
 * Two-way binding between URL query params and typed filter state. Filters therefore survive
 * reloads, are shareable links and work with the browser back button. Changing any filter resets
 * `page` to 1 unless the patch sets `page` itself.
 */
export function useQueryParams<T extends Record<string, Primitive>>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const out: Record<string, Primitive> = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const raw = searchParams.get(key);
      if (raw === null) continue;
      const def = defaults[key];
      if (typeof def === 'number') {
        const n = Number(raw);
        out[key] = Number.isFinite(n) ? n : def;
      } else if (typeof def === 'boolean') {
        out[key] = raw === 'true';
      } else {
        out[key] = raw;
      }
    }
    return out as T;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults are static per call site
  }, [searchParams]);

  const update = useCallback(
    (patch: Partial<T>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === '' || value === defaults[key]) next.delete(key);
            else next.set(key, String(value));
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults are static per call site
    [setSearchParams],
  );

  return [values, update] as const;
}

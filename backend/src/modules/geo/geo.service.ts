import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Tables/columns the radius search may target. Whitelisted because they are interpolated into SQL. */
const SPATIAL_TARGETS = {
  hardware_stores: { column: 'location' },
  drivers: { column: 'current_location' },
} as const;

export type SpatialTable = keyof typeof SPATIAL_TARGETS;

export interface RadiusQuery {
  table: SpatialTable;
  lat: number;
  lng: number;
  radiusKm: number;
  /** Extra SQL predicate on the table aliased as `s` (e.g. visibility rules). Trusted code only – never user input. */
  where?: string;
  /** Positional parameters referenced by `where` as $4, $5, … */
  params?: unknown[];
}

/**
 * PostGIS radius search.
 *
 * Equivalent to `ST_DWithin(location, point, radius)` but written as an index-assisted bounding-box
 * prefilter (`&&`, served by the GiST index) followed by an exact distance test performed OUTSIDE an
 * optimisation fence (`OFFSET 0`). The explicit form behaves identically on every PostGIS build and
 * avoids a planner bug in the embedded WebAssembly PostGIS used for Docker-free development, where
 * ST_DWithin on an indexed geography column fails at plan time.
 */
@Injectable()
export class GeoService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Map of row id -> distance in kilometres for every row within `radiusKm` of the point. */
  async idsWithinRadius(q: RadiusQuery): Promise<Map<string, number>> {
    const target = SPATIAL_TARGETS[q.table];
    if (!target) throw new Error(`Unsupported spatial table: ${q.table}`);
    const point = 'ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography';
    const radiusM = q.radiusKm * 1000;
    const rows = (await this.dataSource.query(
      `SELECT id, d FROM (
         SELECT s.id, ST_Distance(s."${target.column}", ${point}) AS d
           FROM "${q.table}" s
          WHERE ${q.where ?? 'TRUE'}
            AND s."${target.column}" && ST_Buffer(${point}, $3::float8)
         OFFSET 0
       ) x
       WHERE x.d <= $3::float8`,
      [q.lng, q.lat, radiusM, ...(q.params ?? [])],
    )) as Array<{ id: string; d: number }>;
    return new Map(rows.map((r) => [r.id, Number(r.d) / 1000]));
  }
}

import { VehicleType, haversineKm } from '@hardware-delivery/shared';
import { MockMapsProvider } from './providers/mock-maps.provider';

describe('MockMapsProvider', () => {
  const maps = new MockMapsProvider();
  const malamulele = { lat: -23.0167, lng: 30.6781 };
  const polokwane = { lat: -23.9045, lng: 29.4689 };

  describe('geocodeAddress', () => {
    it('finds South African towns mentioned anywhere in the address', async () => {
      const r = await maps.geocodeAddress('12 Main Road, Malamulele, Limpopo');
      expect(r).toMatchObject({ city: 'Malamulele', province: 'Limpopo' });
      expect(haversineKm({ lat: r!.lat, lng: r!.lng }, malamulele)).toBeLessThan(3);
      expect(r!.formattedAddress).toContain('South Africa');
    });

    it('understands aliases and is case-insensitive', async () => {
      expect((await maps.geocodeAddress('1 Church St, LOUIS TRICHARDT'))!.city).toBe('Makhado');
      expect((await maps.geocodeAddress('somewhere in joburg'))!.city).toBe('Johannesburg');
    });

    it('is deterministic and spreads different streets apart a little', async () => {
      const a1 = await maps.geocodeAddress('5 Oak Street, Polokwane');
      const a2 = await maps.geocodeAddress('5 Oak Street, Polokwane');
      const b = await maps.geocodeAddress('99 Elm Avenue, Polokwane');
      expect(a1).toEqual(a2);
      expect(a1!.lat === b!.lat && a1!.lng === b!.lng).toBe(false);
      expect(
        haversineKm({ lat: a1!.lat, lng: a1!.lng }, { lat: b!.lat, lng: b!.lng }),
      ).toBeLessThan(6);
    });

    it('takes explicit coordinates literally', async () => {
      expect(await maps.geocodeAddress('-23.0167, 30.6781')).toMatchObject({
        lat: -23.0167,
        lng: 30.6781,
        confidence: 1,
      });
    });

    it('returns null when nothing matches', async () => {
      expect(await maps.geocodeAddress('Atlantis')).toBeNull();
      expect(await maps.geocodeAddress('   ')).toBeNull();
    });
  });

  describe('distance, route and ETA', () => {
    it('road distance is longer than the straight line', async () => {
      const straight = haversineKm(malamulele, polokwane);
      const { distanceKm, durationMin } = await maps.calculateDistance(malamulele, polokwane);
      expect(distanceKm).toBeGreaterThan(straight);
      expect(distanceKm).toBeLessThan(straight * 1.5);
      expect(durationMin).toBeGreaterThan(60);
    });

    it('route starts and ends at the requested points', async () => {
      const route = await maps.calculateRoute(malamulele, polokwane);
      expect(route.polyline[0]).toEqual([malamulele.lat, malamulele.lng]);
      expect(route.polyline.at(-1)).toEqual([polokwane.lat, polokwane.lng]);
      expect(route.polyline.length).toBeGreaterThan(10);
      expect(route.distanceKm).toBeGreaterThan(0);
    });

    it('same point costs nothing but never returns zero minutes', async () => {
      expect((await maps.calculateDistance(malamulele, malamulele)).distanceKm).toBe(0);
      expect(await maps.estimateTravelTime(malamulele, malamulele)).toBeGreaterThanOrEqual(1);
    });

    it('heavier vehicles take longer over the same distance', async () => {
      const car = await maps.estimateTravelTime(malamulele, polokwane, VehicleType.CAR);
      const truck = await maps.estimateTravelTime(malamulele, polokwane, VehicleType.TRUCK);
      expect(truck).toBeGreaterThan(car);
    });
  });
});

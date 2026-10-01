import { slugify } from './slug';

describe('slugify', () => {
  it.each([
    ['Cement 42.5R (50kg)', 'cement-42-5r-50kg'],
    ['Malamulele Hardware', 'malamulele-hardware'],
    ['  Nuts & Bolts  ', 'nuts-and-bolts'],
    ['Café Ünïcode', 'cafe-unicode'],
    ['---', ''],
  ])('%s -> %s', (input, expected) => expect(slugify(input)).toBe(expected));

  it('caps the length', () => expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80));
});

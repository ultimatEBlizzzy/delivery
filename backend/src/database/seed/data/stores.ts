export interface SeedStore {
  key: string;
  name: string;
  description: string;
  streetAddress: string;
  suburb?: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  phone: string;
  ownerEmail: string;
  ownerName: [string, string];
  /** Multiplies the typical product price (competitiveness of this store). */
  priceFactor: number;
  /** Share of the catalogue this store stocks (0..1). */
  coverage: number;
  /** Categories this store always stocks (sub- or top-level names). */
  specialities: string[];
  /** How much stock it typically holds (multiplier). */
  stockFactor: number;
  commissionPercent?: number;
  hours?: 'standard' | 'long';
  accent: string;
}

/** Fictional demo stores (names supplied by the product brief). Any resemblance to real businesses is coincidental. */
export const STORES: SeedStore[] = [
  {
    key: 'malamulele',
    name: 'Malamulele Hardware',
    accent: '#ea580c',
    description:
      'Your local one-stop hardware store in Malamulele – building materials, plumbing, electrical and tools.',
    streetAddress: '14 Samora Machel Drive',
    suburb: 'Malamulele Central',
    city: 'Malamulele',
    province: 'Limpopo',
    postalCode: '0982',
    latitude: -23.0167,
    longitude: 30.6781,
    phone: '+27150001001',
    ownerEmail: 'owner.malamulele@demo.test',
    ownerName: ['Joyce', 'Maluleke'],
    priceFactor: 1.0,
    coverage: 0.7,
    specialities: ['Building Materials', 'Plumbing', 'Tools'],
    stockFactor: 1,
  },
  {
    key: 'polokwane',
    name: 'Polokwane Build Centre',
    accent: '#0369a1',
    description:
      'Large-format building centre with trade pricing on cement, timber, roofing and power tools.',
    streetAddress: '88 Industria Road',
    suburb: 'Industria',
    city: 'Polokwane',
    province: 'Limpopo',
    postalCode: '0699',
    latitude: -23.9045,
    longitude: 29.4689,
    phone: '+27150001002',
    ownerEmail: 'owner.polokwane@demo.test',
    ownerName: ['Pieter', 'Mokgadi'],
    priceFactor: 0.94,
    coverage: 0.9,
    specialities: ['Building Materials', 'Tools', 'Paint & Decor', 'Electrical'],
    stockFactor: 2.2,
    commissionPercent: 8,
    hours: 'long',
  },
  {
    key: 'limpopo-builders',
    name: 'Limpopo Builders Warehouse',
    accent: '#15803d',
    description: 'Bulk bricks, blocks, sand, stone and cement for contractors. Trucks welcome.',
    streetAddress: '3 Venda Industrial Park',
    suburb: 'Thohoyandou Industrial',
    city: 'Thohoyandou',
    province: 'Limpopo',
    postalCode: '0950',
    latitude: -22.9456,
    longitude: 30.4849,
    phone: '+27150001003',
    ownerEmail: 'owner.limpopo@demo.test',
    ownerName: ['Rudzani', 'Netshitenzhe'],
    priceFactor: 0.92,
    coverage: 0.5,
    specialities: ['Building Materials', 'Fasteners & Fixings'],
    stockFactor: 4,
    hours: 'long',
  },
  {
    key: 'township',
    name: 'Township Hardware',
    accent: '#7c3aed',
    description: 'Everyday hardware close to home in Giyani – small quantities, friendly service.',
    streetAddress: '21 Main Street',
    suburb: 'Giyani Section A',
    city: 'Giyani',
    province: 'Limpopo',
    postalCode: '0826',
    latitude: -23.3028,
    longitude: 30.7191,
    phone: '+27150001004',
    ownerEmail: 'owner.township@demo.test',
    ownerName: ['Mpho', 'Baloyi'],
    priceFactor: 1.08,
    coverage: 0.45,
    specialities: ['Screws & Nails', 'Paint & Decor', 'Taps & Mixers', 'Cement & Concrete'],
    stockFactor: 0.5,
  },
  {
    key: 'probuild',
    name: 'ProBuild Hardware',
    accent: '#dc2626',
    description: 'Professional-grade tools, electrical supplies and safety gear in Makhado.',
    streetAddress: '57 Krogh Street',
    suburb: 'Louis Trichardt',
    city: 'Makhado',
    province: 'Limpopo',
    postalCode: '0920',
    latitude: -23.0436,
    longitude: 29.9031,
    phone: '+27150001005',
    ownerEmail: 'owner.probuild@demo.test',
    ownerName: ['Johan', 'Ramabulana'],
    priceFactor: 1.05,
    coverage: 0.6,
    specialities: ['Tools', 'Electrical', 'Safety & Workwear', 'Garden & Outdoor'],
    stockFactor: 1.2,
  },
];

/** Staff added in addition to the owners (role is the store role). */
export const EXTRA_STAFF: Array<{
  store: string;
  email: string;
  first: string;
  last: string;
  role: 'MANAGER' | 'STAFF';
}> = [
  {
    store: 'malamulele',
    email: 'manager.malamulele@demo.test',
    first: 'Tsakani',
    last: 'Chauke',
    role: 'MANAGER',
  },
  {
    store: 'malamulele',
    email: 'staff.malamulele@demo.test',
    first: 'Sipho',
    last: 'Mathebula',
    role: 'STAFF',
  },
  {
    store: 'polokwane',
    email: 'manager.polokwane@demo.test',
    first: 'Lerato',
    role: 'MANAGER' as const,
    last: 'Phasha',
  },
];

export interface SeedCategory {
  name: string;
  icon: string;
  /** Top-level category colour (also used for generated product art). */
  color: string;
  children: string[];
}

/** 8 top-level categories and 20 sub-categories (every product belongs to a sub-category or a leaf top-level one). */
export const CATEGORIES: SeedCategory[] = [
  {
    name: 'Building Materials',
    icon: 'brick-wall',
    color: '#c2410c',
    children: [
      'Cement & Concrete',
      'Bricks & Blocks',
      'Sand & Stone',
      'Timber & Boards',
      'Roofing & Waterproofing',
    ],
  },
  {
    name: 'Plumbing',
    icon: 'droplets',
    color: '#0369a1',
    children: ['Pipes & Fittings', 'Taps & Mixers', 'Bathroom'],
  },
  {
    name: 'Electrical',
    icon: 'zap',
    color: '#ca8a04',
    children: ['Cables & Wire', 'Switches & Plugs', 'Lighting', 'Distribution & Protection'],
  },
  {
    name: 'Tools',
    icon: 'hammer',
    color: '#475569',
    children: ['Hand Tools', 'Power Tools', 'Measuring & Marking'],
  },
  {
    name: 'Paint & Decor',
    icon: 'paint-bucket',
    color: '#7c3aed',
    children: ['Interior Paint', 'Exterior Paint', 'Brushes & Accessories'],
  },
  {
    name: 'Fasteners & Fixings',
    icon: 'nut',
    color: '#0f766e',
    children: ['Screws & Nails', 'Bolts & Anchors'],
  },
  { name: 'Safety & Workwear', icon: 'hard-hat', color: '#dc2626', children: [] },
  { name: 'Garden & Outdoor', icon: 'sprout', color: '#15803d', children: [] },
];

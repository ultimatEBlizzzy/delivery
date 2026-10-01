export interface Place {
  name: string;
  aliases?: string[];
  lat: number;
  lng: number;
  province: string;
}

/**
 * A small gazetteer of South African towns used by the mock geocoder. Coordinates are town
 * centres (approximate) – good enough to exercise nearby-store and dispatch logic offline.
 */
export const PLACES: Place[] = [
  { name: 'Malamulele', lat: -23.0167, lng: 30.6781, province: 'Limpopo' },
  { name: 'Giyani', lat: -23.3028, lng: 30.7191, province: 'Limpopo' },
  { name: 'Thohoyandou', lat: -22.9456, lng: 30.4849, province: 'Limpopo' },
  {
    name: 'Makhado',
    aliases: ['Louis Trichardt'],
    lat: -23.0436,
    lng: 29.9031,
    province: 'Limpopo',
  },
  { name: 'Polokwane', aliases: ['Pietersburg'], lat: -23.9045, lng: 29.4689, province: 'Limpopo' },
  { name: 'Tzaneen', lat: -23.8333, lng: 30.1667, province: 'Limpopo' },
  { name: 'Mokopane', lat: -24.1944, lng: 29.0097, province: 'Limpopo' },
  { name: 'Musina', lat: -22.3411, lng: 30.0412, province: 'Limpopo' },
  { name: 'Phalaborwa', lat: -23.9431, lng: 31.1411, province: 'Limpopo' },
  { name: 'Bela-Bela', aliases: ['Warmbaths'], lat: -24.8833, lng: 28.2833, province: 'Limpopo' },
  { name: 'Lephalale', lat: -23.6833, lng: 27.7167, province: 'Limpopo' },
  { name: 'Burgersfort', lat: -24.6667, lng: 30.3167, province: 'Limpopo' },
  { name: 'Hoedspruit', lat: -24.35, lng: 30.95, province: 'Limpopo' },
  { name: 'Mbombela', aliases: ['Nelspruit'], lat: -25.4753, lng: 30.9694, province: 'Mpumalanga' },
  { name: 'Middelburg', lat: -25.7751, lng: 29.4648, province: 'Mpumalanga' },
  { name: 'Witbank', aliases: ['eMalahleni'], lat: -25.8713, lng: 29.2332, province: 'Mpumalanga' },
  {
    name: 'Johannesburg',
    aliases: ['Joburg', 'Jozi'],
    lat: -26.2041,
    lng: 28.0473,
    province: 'Gauteng',
  },
  { name: 'Sandton', lat: -26.1076, lng: 28.0567, province: 'Gauteng' },
  { name: 'Soweto', lat: -26.2485, lng: 27.854, province: 'Gauteng' },
  { name: 'Pretoria', aliases: ['Tshwane'], lat: -25.7479, lng: 28.2293, province: 'Gauteng' },
  { name: 'Midrand', lat: -25.9992, lng: 28.1263, province: 'Gauteng' },
  { name: 'Durban', lat: -29.8587, lng: 31.0218, province: 'KwaZulu-Natal' },
  { name: 'Pietermaritzburg', lat: -29.6006, lng: 30.3794, province: 'KwaZulu-Natal' },
  { name: 'Richards Bay', lat: -28.783, lng: 32.0377, province: 'KwaZulu-Natal' },
  { name: 'Cape Town', lat: -33.9249, lng: 18.4241, province: 'Western Cape' },
  { name: 'Stellenbosch', lat: -33.9321, lng: 18.8602, province: 'Western Cape' },
  { name: 'George', lat: -33.963, lng: 22.4617, province: 'Western Cape' },
  { name: 'Bloemfontein', lat: -29.0852, lng: 26.1596, province: 'Free State' },
  {
    name: 'Gqeberha',
    aliases: ['Port Elizabeth'],
    lat: -33.9608,
    lng: 25.6022,
    province: 'Eastern Cape',
  },
  { name: 'East London', lat: -33.0153, lng: 27.9116, province: 'Eastern Cape' },
  { name: 'Kimberley', lat: -28.7282, lng: 24.7499, province: 'Northern Cape' },
  { name: 'Rustenburg', lat: -25.6676, lng: 27.2421, province: 'North West' },
  { name: 'Mahikeng', lat: -25.8601, lng: 25.6406, province: 'North West' },
];

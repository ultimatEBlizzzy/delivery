/** Public, build-time configuration (never put secrets in VITE_* variables). */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, ''),
  appName: import.meta.env.VITE_APP_NAME || 'BuildRun',
  mapTileUrl: import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; OpenStreetMap contributors',
  enableLocationSimulator: import.meta.env.VITE_ENABLE_LOCATION_SIMULATOR === 'true',
};

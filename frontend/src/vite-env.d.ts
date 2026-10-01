/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_ATTRIBUTION?: string;
  readonly VITE_ENABLE_LOCATION_SIMULATOR?: string;
}

interface ImportMetaEnv {
  readonly VITE_SHOW_DEMO_ACCOUNTS?: string;
}

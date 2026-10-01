# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------------------------
# Web image: builds the React SPA and serves it with nginx, which also reverse-proxies /api and
# /uploads to the API so the browser only ever talks to one origin (no CORS, cookies stay first-party).
# Build from the repository root:  docker build -f docker/frontend.Dockerfile -t hardware-delivery-web .
# ---------------------------------------------------------------------------------------------
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=@hardware-delivery/shared --workspace=@hardware-delivery/frontend
COPY shared shared
COPY frontend frontend
# Public build-time settings (VITE_* values are embedded in the JavaScript bundle: never put secrets here).
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_APP_NAME=BuildRun
ARG VITE_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
ARG VITE_MAP_ATTRIBUTION="&copy; OpenStreetMap contributors"
ARG VITE_ENABLE_LOCATION_SIMULATOR=false
ARG VITE_SHOW_DEMO_ACCOUNTS=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL \
    VITE_MAP_ATTRIBUTION=$VITE_MAP_ATTRIBUTION \
    VITE_ENABLE_LOCATION_SIMULATOR=$VITE_ENABLE_LOCATION_SIMULATOR \
    VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS
RUN npm run build -w @hardware-delivery/shared && npm run build -w @hardware-delivery/frontend

FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1

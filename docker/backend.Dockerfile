# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------------------------
# API image. Multi-stage: build with dev dependencies, ship only production dependencies.
# Build from the repository root:  docker build -f docker/backend.Dockerfile -t hardware-delivery-api .
# glibc-based (bookworm-slim) because argon2 ships prebuilt glibc/musl binaries and glibc is the
# most widely tested.
# ---------------------------------------------------------------------------------------------
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
# Manifests first so the dependency layer is cached until a package.json changes.
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=@hardware-delivery/shared --workspace=@hardware-delivery/backend
COPY shared shared
COPY backend backend
RUN npm run build -w @hardware-delivery/shared && npm run build -w @hardware-delivery/backend

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev --workspace=@hardware-delivery/shared --workspace=@hardware-delivery/backend \
    && npm cache clean --force

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads
WORKDIR /app/backend
COPY --from=deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=deps --chown=node:node /app/package.json /app/package.json
COPY --from=build --chown=node:node /app/shared/package.json /app/shared/package.json
COPY --from=build --chown=node:node /app/shared/dist /app/shared/dist
COPY --from=build --chown=node:node /app/backend/package.json /app/backend/package.json
COPY --from=build --chown=node:node /app/backend/dist /app/backend/dist
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
VOLUME ["/app/uploads"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Applies pending migrations, then starts the API. Prefer a separate migration job in larger deployments.
CMD ["sh", "-c", "node dist/database/cli/migrate.js && node dist/main.js"]

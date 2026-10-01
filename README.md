# BuildRun – hardware e-hailing & delivery marketplace (South Africa)

Customers order hardware and building materials from nearby hardware stores; the platform finds a
driver whose **vehicle can actually carry the load** (a bakkie for cement, a truck for 30 bags – never
a motorcycle) and delivers it, with live tracking, mock-first payments and an admin console.

Four roles, one codebase:

| Role | Surface | What they do |
| --- | --- | --- |
| **Customer** | Mobile-first web app (`/`) | Browse stores & products, cart, checkout, pay, track delivery |
| **Hardware store** | Store portal (`/store`) | Manage listings, prices, stock; accept → prepare → mark ready |
| **Driver** | Mobile-first portal (`/driver`) | Go online, accept offers, collect & deliver with proof |
| **Admin** | Console (`/admin`) | Stores, catalogue, pricing, dispatch, payments, reports, settings |

> **Status:** built in phases. This README documents what is implemented at each phase boundary –
> see [Roadmap](#roadmap--phases).

---

## Quick start

Prerequisites: **Node.js ≥ 20.11** (22 LTS recommended) and npm ≥ 10. Docker is optional.

```bash
git clone <this repo> && cd delivery
cp .env.example .env          # review the values marked CHANGE-ME (fine as-is for local development)
npm install                   # installs all workspaces (shared, backend, frontend)
```

Pick **one** way to get PostgreSQL + PostGIS:

### A. Docker for the database (recommended)

```bash
npm run db:up                 # docker compose up -d db   (postgis/postgis, port 5432)
npm run db:migrate            # create the schema
npm run admin:create -w @hardware-delivery/backend -- --email you@example.com --password 'S3cure-Passw0rd'
npm run dev                   # API :3000 + web :5173 with hot reload
```

### B. No Docker – embedded PostGIS

PostgreSQL 18 + PostGIS compiled to WebAssembly (PGlite) behind the normal PostgreSQL protocol. Great
for laptops without Docker and for CI smoke tests; use the Docker image for anything production-like.

```bash
npm run db:embedded           # leave running in its own terminal – prints the DATABASE_URL to use
# put that URL in .env →  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/postgres
npm run db:migrate
npm run dev
```

(~1 GB RAM. Data lives in `.pglite-data/`; delete the folder for a clean slate or pass `--memory`.)

### C. Everything in Docker

```bash
docker compose up -d --build  # db + API (migrates on start) + web (nginx)
# web http://localhost:8080   ·   API docs http://localhost:3000/api/docs
```

Open **http://localhost:5173** (npm dev) or **http://localhost:8080** (Docker).

---

## Repository layout

```
.
├── backend/            NestJS 11 API (TypeORM, PostgreSQL + PostGIS)
│   ├── src/modules/    feature modules (auth, users, settings, audit, …)
│   ├── src/database/   entities barrel, naming strategy, migrations, CLI tools
│   ├── test/           e2e tests (boot the real app against a real database)
│   └── scripts/        embedded-db.mjs (Docker-free PostGIS)
├── frontend/           React 19 + Vite + Tailwind CSS 4 single-page app
├── shared/             Enums, order/delivery state machines, settings schema, money & geo helpers
│                       (one source of truth imported by BOTH backend and frontend)
├── docker/             Dockerfiles, nginx config, Postgres init scripts
├── docker-compose.yml  db + backend + frontend
├── docs/               Architecture notes
└── .env.example        Every environment variable, documented
```

## Tech stack

**Backend** NestJS · TypeScript · TypeORM · PostgreSQL 16+ with **PostGIS** · JWT access tokens + rotating
refresh tokens · Argon2id · class-validator · Swagger/OpenAPI · Jest + Supertest
**Frontend** React · TypeScript · Vite · Tailwind CSS · React Router · TanStack Query · Zustand ·
React Hook Form + Zod · Leaflet · Recharts · Vitest + Testing Library
**Ops** Docker Compose · nginx · GitHub Actions CI

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web with hot reload (builds `shared` first) |
| `npm run build` | Production builds of shared, backend and frontend |
| `npm test` | Unit tests (backend + frontend) – no database needed |
| `npm run test:e2e` | Integration tests against a real PostGIS database (see [Testing](#testing)) |
| `npm run typecheck` · `npm run lint` | Static checks |
| `npm run db:migrate` | Apply pending migrations |
| `npm run migration:generate -w @hardware-delivery/backend -- Name` | Generate a migration from entity changes |
| `npm run migration:check -w @hardware-delivery/backend` | Fail if entities and migrations disagree |

## Configuration

All configuration is environment-driven; **no secrets live in the code**. `.env.example` documents every
variable. Highlights:

* `JWT_ACCESS_SECRET`, `STORAGE_SIGNING_SECRET` – ≥ 32 random characters (`openssl rand -base64 48`).
  Missing/short secrets stop the API at boot; in production placeholder values are rejected too.
* `PAYMENT_PROVIDER`, `MAPS_PROVIDER`, `STORAGE_PROVIDER` – default to working **mock** implementations.
  Mocks are refused in production unless `ALLOW_MOCK_PROVIDERS_IN_PRODUCTION=true` (staging/demo).
* `CORS_ORIGINS` – explicit allow-list (required in production). The web app talks to the API through a
  same-origin proxy (Vite in dev, nginx in Docker), so cookies stay first-party.
* `TEST_DATABASE_URL` – optional; by default the e2e suite starts its own throw-away embedded database.

Only `VITE_*` variables reach the browser bundle, and they must never contain secrets.

## Database & migrations

* Schema changes happen **only through migrations** (`synchronize` is off). Migrations are generated from
  the entity decorators and then reviewed/edited by hand (extensions, reference data).
* A **schema-drift test** (part of `npm run test:e2e`, also `npm run migration:check`) fails when an
  entity is changed without a migration.
* Identifiers are `snake_case` with readable constraint names (`fk_orders_store_id`, `uq_users_email`).
* PostGIS `geography(Point, 4326)` columns with GiST indexes power distance queries.

## Authentication & security (implemented)

* **Argon2id** password hashing (OWASP parameters), password policy, account lock-out after repeated failures
  and timing-equalised login (unknown emails cost the same as wrong passwords).
* **15-minute JWT access token** kept in memory by the SPA; **rotating opaque refresh token** stored hashed
  (SHA-256) in the database and delivered as an `HttpOnly; SameSite=Strict` cookie scoped to `/api/v1/auth`.
  Re-using an already-rotated refresh token revokes the whole token family (theft detection).
* Roles and account status are re-read from the database on every request, so deactivating a user takes
  effect immediately.
* Global guards: rate limiting → JWT → role check. Routes are **private by default**; public routes must opt
  in with `@Public()`.
* `helmet`, strict CORS allow-list, `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` (clients
  cannot smuggle fields such as `role`, `price` or `total`), request ids on every response, consistent
  error envelope that never leaks internals.
* Audit log for sensitive actions.

## Testing

```bash
npm test            # unit: config validation, state machines, money maths, exception mapping, UI components, HTTP client…
npm run test:e2e    # integration: full Nest app + real PostgreSQL/PostGIS
```

The e2e suite needs no setup: unless `TEST_DATABASE_URL` is set it launches the embedded PostGIS database
on a free port, migrates it, runs every spec and shuts it down. To run against a real server instead, set
`TEST_DATABASE_URL` to a database whose name contains `test` (its schema is wiped before the run; the Docker
Compose database creates `hardware_delivery_test` for you). CI does exactly that with a PostGIS service.

## Roadmap / phases

- [x] **Phase 1 – Foundation:** monorepo, shared package, config, PostgreSQL/PostGIS + migrations, auth
      (register/login/refresh/logout), RBAC, audit log, platform settings, Docker, CI, frontend shell,
      sign-in pages for all four roles, admin settings & audit-log screens.
- [ ] Phase 2 – Core data model: stores, categories, products, store listings, inventory
- [ ] Phase 3 – Customer experience: browse, cart, checkout
- [ ] Phase 4 – Orders, pricing & mock payments
- [ ] Phase 5 – Drivers & vehicles
- [ ] Phase 6 – Dispatch engine
- [ ] Phase 7 – Realtime tracking & notifications
- [ ] Phase 8 – Admin dashboard & reports
- [ ] Phase 9 – Security hardening
- [ ] Phase 10 – Tests, seed data & documentation

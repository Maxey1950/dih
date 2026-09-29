# Revival

A 2016-style Roblox revival:

```
AlphaBlox 2016-style frontend (web/)
  → clean API (api/, Fastify + Zod)
  → PostgreSQL (database/, Prisma)
  → custom launcher (launcher/, ourrevival://)
  → Roblox Freedom Distribution 2018 / v347 (rfd/)
```

| Directory | Status (Phase 1) |
|---|---|
| `web/` | AlphaBlox frontend migrated to Next 16 / React 19. It talks only to same-origin `/api/*` and assumes session-cookie auth. |
| `api/` | Fastify + TypeScript. Serves `GET /health` and `GET /api/auth/me` (always anonymous for now). |
| `shared/` | Zod schemas and TypeScript types for the public API contract (`User`, `Game`, `AuthMeResponse`, `ApiError`). |
| `database/` | Prisma 7 schema and initial migration for `User`, `Session` and `Game` (PostgreSQL). |
| `launcher/` | README only: the planned `ourrevival://join?ticket=…` flow. |
| `rfd/` | README only: RFD v347 integration notes. Nothing is downloaded or executed. |
| `infra/` | `docker-compose.yml` for local PostgreSQL. |
| `docs/` | Migration map, dependency security log, legacy/quarantine notes. |

> **Legacy donor code:** AlphaBlox's `server/` and `2015/` (RCC binaries) are
> intentionally absent. See [`docs/legacy-donor.md`](docs/legacy-donor.md).
> **Do not deploy or execute them.**

## Quick start

Requires Node 22+.

```bash
npm install                    # shared, api, database (npm workspaces)
npm install --prefix web       # frontend

npm run build                  # builds shared + api
npm test                       # API tests

npm run dev:api                # API on http://127.0.0.1:4000
npm run dev:web                # web on http://localhost:3000 (proxies /api → API_ORIGIN)
```

Database (optional in Phase 1; the API does not use it yet):

```bash
docker compose -f infra/docker-compose.yml up -d
cp database/.env.example database/.env
npm run migrate:deploy -w @revival/database
```

To opt out of Next.js telemetry: `npx next telemetry disable` (or set `NEXT_TELEMETRY_DISABLED=1`).

## Phase 1 migration: `alphablox-next/client` → `web/`

Source: `singharaj-usai/alphablox-next@715903d`. Kept and adapted:

- `client/src/app/**` → `web/src/app/**` (all pages except `games/data.js` and `admin/dashboard/`)
- `client/src/sections/{Navbar,Footer}.js` → `web/src/sections/`
- `client/src/components/{Alerts/*,UserSubmenu,ResendVerification}.js` → `web/src/components/`
- `client/src/contexts/ThemeContext.js`, `client/src/hooks/useTheme.js` → `web/src/contexts/`, `web/src/hooks/`
- `client/src/lib/utils/{dateUtils,textHelper,wordValidation}.js` → `web/src/lib/utils/`
- `client/public/images/*`, `client/src/fonts/*`, `client/config/metadata.js`, `jsconfig.json`, `.gitignore` → `web/`

See [`docs/alphablox-migration-map.md`](docs/alphablox-migration-map.md) for the full audit, and
[`docs/dependency-security.md`](docs/dependency-security.md) for dependency changes.

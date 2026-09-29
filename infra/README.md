# infra/

Local development and, later, deployment configuration.

- `docker-compose.yml` runs PostgreSQL 17 on `127.0.0.1:5432` with the
  credentials from `database/.env.example`. These are for local use only.

Planned (not in Phase 1): reverse proxy config (routing `/api/*` to the API and
everything else to the web app, TLS, rate limits), CI (lint, typecheck, tests,
`npm audit`, secret scanning), and production service definitions.

No donor deployment configuration (Vercel, Render.com, MongoDB Atlas) is used.

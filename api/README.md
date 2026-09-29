# api/ — backend (Fastify + TypeScript + Zod + Prisma)

```bash
cp api/.env.example api/.env            # set DATABASE_URL and COOKIE_SECRET
npm run build                            # shared + database (prisma generate) + api
npm run dev -w @revival/api              # http://127.0.0.1:4000 (reads env from the shell)
npm test                                 # needs PostgreSQL; see "Tests" below
npm run sessions:cleanup                 # delete expired sessions (cron this in production)
npm run user:set-role -w @revival/api -- <username> admin
npm run seed:dev                         # sample games (development only)
npm run server -- --game <id|placeId> --host <h> --port <p>   # provision a game server (prints credential once)
npm run servers:list / npm run servers:reap
npm run tickets                          # delete old join tickets (cron every 10 min)
```

Routes, the session/CSRF design, rate limits and presence are documented in
[`docs/phase-2-accounts.md`](../docs/phase-2-accounts.md).

Layout:

- `src/auth/session.ts`: the only place a cookie becomes a user (`request.auth`)
- `src/auth/guards.ts`: `optionalAuth`, `requireAuth`, `requireRole`, `requireAdmin`
- `src/auth/password.ts`: argon2id hashing
- `src/plugins/csrf.ts`: CSRF token plus Origin check for POST/PUT/PATCH/DELETE
- `src/users/serialize.ts`: allow-list serializers (no hashes, emails or security fields)
- `src/routes/*`: auth, users, social (friends/follows), games, internal-servers, admin (read-only)
- `src/servers/*`: server credentials, provisioning, liveness policy (30 s heartbeat, 90 s stale)
- `src/games/*`: player-count aggregation, game serializers
- `src/tickets/*`: join tickets (issue, server selection, validation); routes `launcher.ts`, `internal-tickets.ts`

## Tests

`node:test` via tsx, against a real PostgreSQL database (`TEST_DATABASE_URL`,
default `postgresql://revival@127.0.0.1:55432/revival_test`). The database must
have the migrations applied:

```bash
DATABASE_URL=$TEST_DATABASE_URL npm run migrate:deploy -w @revival/database
TEST_DATABASE_URL=... npm test
```

Tests truncate all tables, so never point them at a real database.

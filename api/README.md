# api/ — backend (Fastify + TypeScript + Zod)

```bash
npm run build -w @revival/shared   # once, or: npm run build (root)
npm run dev -w @revival/api        # tsx watch, http://127.0.0.1:4000
npm test -w @revival/api
```

Phase 1 endpoints:

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `HealthResponse` |
| GET | `/api/auth/me` | `AuthMeResponse`. Always `{ authenticated: false, user: null }` until sessions exist. `Cache-Control: no-store`. |

All errors use the shared `ApiError` shape: `{ error: { code, message, details? } }`.
The logger redacts `Authorization`, `Cookie` and `Set-Cookie`.

Configuration is read from the environment and validated with Zod
(`src/config.ts`): `HOST`, `PORT`, `LOG_LEVEL`, `NODE_ENV`. See `.env.example`.

No AlphaBlox backend code is used. The session design (opaque token in a
Secure/HttpOnly/SameSite cookie, stored hashed in `sessions`) is documented in
`src/routes/auth.ts` and `database/prisma/schema.prisma`.

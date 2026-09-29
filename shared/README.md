# shared/ — public API contract

Zod schemas plus inferred TypeScript types used by `api/` (and, later, the
launcher): `User`, `CurrentUser`, `Game`, `AuthMeResponse`, `ApiError`,
`HealthResponse`.

RFD internals (hosts, ports, join tickets) are deliberately excluded; they get
separate internal schemas in Phase 2.

```bash
npm run build -w @revival/shared
```

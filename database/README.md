# database/ — PostgreSQL schema (Prisma 7)

- `prisma/schema.prisma`: `User`, `Session`, `Friendship`, `Follow`, `Game`.
  Catalog, economy, groups, forum and messages come later.
- `prisma/migrations/20260929000000_init/`: Phase 1.
- `prisma/migrations/20260930000000_accounts_sessions_social/`: Phase 2. It is
  generated, then hand-edited to rename columns and add CHECK constraints (see
  the comments in the file).
- `src/index.ts`: `createPrismaClient(url)` (node-postgres driver adapter), used by `api/`.
- `prisma.config.ts`: reads `DATABASE_URL` (see `.env.example`).

```bash
npm run validate -w @revival/database
npm run generate -w @revival/database        # client output: database/generated/prisma (gitignored)
DATABASE_URL=… npm run migrate:deploy -w @revival/database
```

No donor MongoDB data or models are imported.

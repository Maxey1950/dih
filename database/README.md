# database/ — PostgreSQL schema (Prisma 7)

- `prisma/schema.prisma`: `User`, `Session`, `Game` only. Catalog, economy,
  groups, forum and messages come later.
- `prisma/migrations/20260929000000_init/`: initial SQL migration.
- `prisma.config.ts`: reads `DATABASE_URL` (see `.env.example`).

```bash
npm run validate -w @revival/database
npm run generate -w @revival/database        # client output: database/generated/prisma (gitignored)
DATABASE_URL=… npm run migrate:deploy -w @revival/database
```

No donor MongoDB data or models are imported.

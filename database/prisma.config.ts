import { defineConfig } from 'prisma/config';

// DATABASE_URL is only required by commands that talk to a database
// (migrate, db push). `prisma validate`, `format` and `generate` work without it.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});

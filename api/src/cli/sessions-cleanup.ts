/**
 * Delete expired sessions. Safe to run any time; run it from cron in production, e.g.
 *   17 * * * *  cd /srv/revival && npm run sessions:cleanup -w @revival/api
 * Expired sessions are also deleted opportunistically when presented and at login.
 */
import { createPrismaClient } from '@revival/database';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const prisma = createPrismaClient(url);
const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
console.log(`Deleted ${count} expired session(s).`);
await prisma.$disconnect();

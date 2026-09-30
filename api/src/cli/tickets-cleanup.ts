/**
 * Delete old join tickets. Security never depends on this: every read checks
 * expiry/redemption/revocation directly. Suggested cron: every 10 minutes.
 *   npm run tickets
 * Deletes tickets that expired more than 1 hour ago, and redeemed or revoked
 * tickets older than 24 hours (kept briefly for troubleshooting). Never deletes
 * an active ticket; safe to run concurrently (see src/tickets/cleanup.ts).
 */
import { createPrismaClient } from '@revival/database';
import { cleanupTickets } from '../tickets/cleanup.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const prisma = createPrismaClient(url);
try {
  const count = await cleanupTickets(prisma);
  console.log(`Deleted ${count} old join ticket(s).`);
} finally {
  await prisma.$disconnect();
}

/**
 * Delete old join tickets. Security never depends on this: every read checks
 * expiry/redemption/revocation directly. Suggested cron: every 10 minutes.
 *   npm run tickets
 * Deletes tickets that expired more than 1 hour ago, and redeemed or revoked
 * tickets older than 24 hours (kept briefly for troubleshooting).
 */
import { createPrismaClient } from '@revival/database';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const prisma = createPrismaClient(url);
const now = Date.now();
const hourAgo = new Date(now - 60 * 60 * 1000);
const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
const { count } = await prisma.joinTicket.deleteMany({
  where: {
    OR: [
      { expiresAt: { lt: hourAgo } },
      { redeemedAt: { lt: dayAgo } },
      { revokedAt: { lt: dayAgo } },
    ],
  },
});
console.log(`Deleted ${count} old join ticket(s).`);
await prisma.$disconnect();

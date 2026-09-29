/**
 * Mark stale game servers offline (housekeeping). Reads already ignore stale
 * servers via the policy cutoff, so this only keeps stored status tidy.
 * Suggested cron: every minute.  `npm run servers:reap`
 */
import { createPrismaClient } from '@revival/database';
import { staleCutoff, STALE_AFTER_SECONDS } from '../servers/policy.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const prisma = createPrismaClient(url);
const { count } = await prisma.gameServer.updateMany({
  where: {
    status: { not: 'offline' },
    OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: staleCutoff() } }],
  },
  data: { status: 'offline', playerCount: 0 },
});
console.log(`Marked ${count} stale server(s) offline (no heartbeat for ${STALE_AFTER_SECONDS}s).`);
await prisma.$disconnect();

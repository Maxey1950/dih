/** List registered game servers (no credentials; hashes are never printed). */
import { createPrismaClient } from '@revival/database';
import { isStale } from '../servers/policy.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const prisma = createPrismaClient(url);
const servers = await prisma.gameServer.findMany({ include: { game: true }, orderBy: { createdAt: 'asc' } });
for (const s of servers) {
  const state = s.status !== 'offline' && isStale(s.lastHeartbeatAt) ? `${s.status} (stale)` : s.status;
  console.log(`${s.id}  place=${s.game.placeId}  ${s.host}:${s.port}  ${state}  ${s.playerCount}/${s.maxPlayers}  last=${s.lastHeartbeatAt?.toISOString() ?? 'never'}`);
}
if (servers.length === 0) console.log('No game servers registered.');
await prisma.$disconnect();

/**
 * Revoke a game server: deletes its identity (and so its credential hash).
 *   npm run server:revoke -- --id <serverId>
 */
import { parseArgs } from 'node:util';
import { createPrismaClient } from '@revival/database';

const { values } = parseArgs({ options: { id: { type: 'string' } }, strict: true });
const url = process.env.DATABASE_URL;
if (!values.id || !url) {
  console.error('Usage: DATABASE_URL=... server:revoke --id <serverId>');
  process.exit(1);
}
const prisma = createPrismaClient(url);
const { count } = await prisma.gameServer.deleteMany({ where: { id: values.id } });
console.log(count ? `Revoked server ${values.id}.` : `No server ${values.id}.`);
await prisma.$disconnect();

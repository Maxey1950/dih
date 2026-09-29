/**
 * Provision a game-server identity and print its credential ONCE.
 *
 *   npm run server:provision -- --game <gameId|placeId> --host 127.0.0.1 --port 2005 [--max 20]
 *
 * The database stores only SHA-256(credential). Treat the printed credential
 * like a password: put it in the game server's secret store / environment
 * (GAME_SERVER_CREDENTIAL), never in a repository, command line or log.
 * Lost credentials cannot be recovered; revoke the server and provision a new one.
 */
import { parseArgs } from 'node:util';
import { createPrismaClient } from '@revival/database';
import { provisionServer } from '../servers/provision.js';
import { HEARTBEAT_INTERVAL_SECONDS } from '../servers/policy.js';

const { values } = parseArgs({
  options: {
    game: { type: 'string' },
    host: { type: 'string' },
    port: { type: 'string' },
    max: { type: 'string' },
  },
  strict: true,
});
if (!values.game || !values.host || !values.port) {
  console.error('Usage: server:provision --game <gameId|placeId> --host <host> --port <port> [--max <players>]');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const prisma = createPrismaClient(url);
try {
  const game = /^\d+$/.test(values.game)
    ? await prisma.game.findUnique({ where: { placeId: Number(values.game) } })
    : await prisma.game.findUnique({ where: { id: values.game } });
  if (!game) throw new Error('Game not found');
  const { server, credential } = await provisionServer(prisma, {
    gameId: game.id,
    host: values.host,
    port: Number(values.port),
    maxPlayers: values.max ? Number(values.max) : undefined,
  });
  console.log(`Provisioned game server for "${game.name}" (place ${game.placeId}).`);
  console.log(`  GAME_SERVER_ID=${server.id}`);
  console.log(`  GAME_SERVER_CREDENTIAL=${credential}`);
  console.log('The credential is shown only once and is not stored. Keep it secret.');
  console.log(`Heartbeat every ${HEARTBEAT_INTERVAL_SECONDS}s: POST /api/internal/servers/${server.id}/heartbeat`);
} catch (err) {
  console.error(`Provisioning failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

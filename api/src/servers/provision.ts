import type { GameServer, PrismaClient } from '@revival/database';
import { generateServerCredential, hashServerCredential } from './credentials.js';

export interface ProvisionInput {
  gameId: string;
  host: string;
  port: number;
  maxPlayers?: number;
}

const HOST_PATTERN = /^(?=.{1,255}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$|^\[?[0-9A-Fa-f:.]+\]?$/;

/**
 * Create a game-server identity. Returns the raw credential ONCE; only its
 * hash is persisted. Used by the provisioning CLI and tests; there is no
 * unauthenticated HTTP registration endpoint.
 */
export async function provisionServer(
  prisma: PrismaClient,
  { gameId, host, port, maxPlayers }: ProvisionInput
): Promise<{ server: GameServer; credential: string }> {
  if (!HOST_PATTERN.test(host)) throw new Error('Invalid host');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.deletedAt) throw new Error('Game not found');
  const credential = generateServerCredential();
  const server = await prisma.gameServer.create({
    data: {
      gameId,
      host,
      port,
      maxPlayers: maxPlayers ?? game.maxPlayers,
      credentialHash: hashServerCredential(credential),
      status: 'offline',
    },
  });
  return { server, credential };
}

import type { FastifyPluginAsync } from 'fastify';
import { ServerHeartbeatRequest, ServerStateResponse } from '@revival/shared';
import type { GameServer } from '@revival/database';
import { parse } from '../validate.js';
import { authenticateServerForPathId } from '../servers/auth.js';
import { HEARTBEAT_INTERVAL_SECONDS } from '../servers/policy.js';

/**
 * INTERNAL game-server API (/api/internal/servers/*).
 *
 * Machine-to-machine only:
 * - Authenticated ONLY by the per-server credential in `Authorization: Bearer`.
 *   User sessions, admin cookies and CSRF tokens are ignored here: the session
 *   resolver and CSRF hook skip /api/internal/, so a logged-in admin gets the
 *   same 401 as anyone else.
 * - The credential is bound to the server id in the URL, so one server cannot
 *   act for another.
 * - Fixed, typed endpoints only. There is no command channel, script
 *   execution or method dispatch by name.
 * - The web app's /api proxy does not forward /api/internal/*; game servers
 *   talk to the API directly on the internal network.
 */
function stateOf(server: GameServer) {
  return ServerStateResponse.parse({
    server: {
      id: server.id,
      status: server.status,
      playerCount: server.playerCount,
      maxPlayers: server.maxPlayers,
      heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
    },
  });
}

export const internalServerRoutes: FastifyPluginAsync = async (app) => {
  const opts = { preHandler: authenticateServerForPathId(app) };

  app.post('/api/internal/servers/:id/heartbeat', opts, async (request) => {
    const server = request.gameServer!;
    const body = parse(ServerHeartbeatRequest, request.body);
    const now = new Date();
    // A draining server stays draining; otherwise use the reported status (default online).
    const status = server.status === 'draining' ? 'draining' : (body.status ?? 'online');
    const updated = await app.prisma.gameServer.update({
      where: { id: server.id },
      data: {
        playerCount: body.playerCount,
        maxPlayers: body.maxPlayers,
        status,
        lastHeartbeatAt: now,
        ...(server.status === 'offline' || !server.startedAt ? { startedAt: now } : {}),
      },
    });
    return stateOf(updated);
  });

  /** Stop accepting new players (Phase 4 matchmaking skips draining servers). */
  app.post('/api/internal/servers/:id/drain', opts, async (request) => {
    const updated = await app.prisma.gameServer.update({
      where: { id: request.gameServer!.id },
      data: { status: 'draining', lastHeartbeatAt: new Date() },
    });
    return stateOf(updated);
  });

  /** Graceful shutdown. Crashed servers simply go stale instead. */
  app.post('/api/internal/servers/:id/offline', opts, async (request) => {
    const updated = await app.prisma.gameServer.update({
      where: { id: request.gameServer!.id },
      data: { status: 'offline', playerCount: 0 },
    });
    return stateOf(updated);
  });
};

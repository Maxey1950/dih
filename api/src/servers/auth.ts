import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { GameServer } from '@revival/database';
import { AppError } from '../errors.js';
import { credentialMatches, hashServerCredential, parseServerAuthorization } from './credentials.js';

/**
 * Game-server (machine) authentication for /api/internal/*. Only the
 * `Authorization: Bearer rvgs_...` credential is accepted; cookies, sessions,
 * CSRF tokens and join tickets are never consulted here.
 */
declare module 'fastify' {
  interface FastifyRequest {
    gameServer?: GameServer;
  }
}

const unauthorized = () => new AppError(401, 'UNAUTHENTICATED', 'Invalid server credentials.');

/** For /api/internal/servers/:id/* : the credential must belong to the server in the URL. */
export function authenticateServerForPathId(app: FastifyInstance) {
  return async (request: FastifyRequest) => {
    const params = z.object({ id: z.uuid() }).safeParse(request.params);
    const credential = parseServerAuthorization(request.headers.authorization);
    if (!params.success || !credential) throw unauthorized();
    const server = await app.prisma.gameServer.findUnique({ where: { id: params.data.id } });
    if (!server || !credentialMatches(credential, server.credentialHash)) throw unauthorized();
    request.gameServer = server;
  };
}

/** For routes without a server id in the URL: identify the server by its credential (unique hash). */
export function authenticateServerByCredential(app: FastifyInstance) {
  return async (request: FastifyRequest) => {
    const credential = parseServerAuthorization(request.headers.authorization);
    if (!credential) throw unauthorized();
    const server = await app.prisma.gameServer.findUnique({ where: { credentialHash: hashServerCredential(credential) } });
    if (!server || !credentialMatches(credential, server.credentialHash)) throw unauthorized();
    request.gameServer = server;
  };
}

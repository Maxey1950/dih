import type { FastifyPluginAsync } from 'fastify';
import { LauncherResolveRequest, LauncherResolveResponse } from '@revival/shared';
import { AppError } from '../errors.js';
import { hashTicket, MAX_RESOLVES } from '../tickets/tickets.js';
import { ticketProblem } from '../tickets/validate.js';

const invalid = () => new AppError(404, 'TICKET_INVALID', 'This join ticket is invalid or has expired.');

/**
 * Native launcher API. The raw join ticket in the body is the ONLY proof:
 * no browser cookie, session, password or server credential is involved
 * (the session resolver and CSRF hook skip /api/launcher/*).
 *
 * Resolving does NOT consume the ticket; the game server's redemption does.
 * It returns the host/port of the server chosen at issuance (the caller cannot
 * pick one) and allows at most MAX_RESOLVES resolves per ticket. Every failure
 * returns the same generic TICKET_INVALID, so the endpoint is no oracle.
 */
export const launcherRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/launcher/ticket/resolve',
    { config: { rateLimit: { max: app.config.RATE_LIMIT_RESOLVE_MAX, timeWindow: '1 minute' } } },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const body = LauncherResolveRequest.safeParse(request.body);
      if (!body.success) throw invalid();
      const tokenHash = hashTicket(body.data.ticket);
      const ticket = await app.prisma.joinTicket.findUnique({
        where: { tokenHash },
        include: { user: true, game: true, server: true },
      });
      const now = new Date();
      const problem = ticket ? ticketProblem(ticket, now) : 'invalid';
      if (!ticket || problem) {
        request.log.info({ ticketId: ticket?.id, reason: problem }, 'launcher resolve rejected');
        throw invalid();
      }

      // Atomic resolve-budget check; never touches redeemedAt.
      const counted = await app.prisma.joinTicket.updateMany({
        where: { id: ticket.id, resolveCount: { lt: MAX_RESOLVES }, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { resolveCount: { increment: 1 } },
      });
      if (counted.count === 0) {
        request.log.info({ ticketId: ticket.id, reason: 'resolve_limit' }, 'launcher resolve rejected');
        throw invalid();
      }
      if (!ticket.launcherResolvedAt) {
        await app.prisma.joinTicket.updateMany({ where: { id: ticket.id, launcherResolvedAt: null }, data: { launcherResolvedAt: now } });
      }
      request.log.info({ ticketId: ticket.id, serverId: ticket.serverId }, 'launcher resolved ticket');

      return LauncherResolveResponse.parse({
        game: { id: ticket.game.id, placeId: ticket.game.placeId, name: ticket.game.name },
        server: { host: ticket.server.host, port: ticket.server.port },
        player: { id: ticket.user.id, numericId: ticket.user.numericId, username: ticket.user.username },
        ticket: { expiresAt: ticket.expiresAt.toISOString() },
      });
    }
  );
};

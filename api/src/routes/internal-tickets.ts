import type { FastifyPluginAsync } from 'fastify';
import { RedeemTicketRequest, RedeemTicketResponse } from '@revival/shared';
import { AppError } from '../errors.js';
import { authenticateServerByCredential } from '../servers/auth.js';
import { hashTicket } from '../tickets/tickets.js';
import { ticketProblem, type TicketRejection } from '../tickets/validate.js';

const reject = (reason: TicketRejection) =>
  new AppError(403, 'JOIN_REJECTED', 'Join ticket rejected.', { reason });

/**
 * INTERNAL: POST /api/internal/join-tickets/redeem
 *
 * Called by the game server (RFD adapter) with ITS machine credential. The
 * ticket must have been issued for THIS server. On success the ticket is
 * consumed atomically (redeemedAt set by a conditional UPDATE), so two
 * simultaneous redemptions cannot both succeed. Identity comes only from the
 * backend: the caller cannot supply a username or user id.
 */
export const internalTicketRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/internal/join-tickets/redeem', { preHandler: authenticateServerByCredential(app) }, async (request) => {
    const server = request.gameServer!;
    const body = RedeemTicketRequest.safeParse(request.body);
    if (!body.success) throw reject('invalid');

    const ticket = await app.prisma.joinTicket.findUnique({
      where: { tokenHash: hashTicket(body.data.ticket) },
      include: { user: true, game: true, server: true },
    });
    // Unknown ticket or a ticket for a different server: indistinguishable.
    if (!ticket || ticket.serverId !== server.id) {
      request.log.info({ serverId: server.id, ticketId: ticket?.id, reason: 'invalid' }, 'redeem rejected');
      throw reject('invalid');
    }
    const now = new Date();
    const problem = ticketProblem(ticket, now);
    if (problem) {
      request.log.info({ serverId: server.id, ticketId: ticket.id, userId: ticket.userId, reason: problem }, 'redeem rejected');
      throw reject(problem);
    }

    // Atomic one-time consumption.
    const consumed = await app.prisma.joinTicket.updateMany({
      where: { id: ticket.id, serverId: server.id, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { redeemedAt: now },
    });
    if (consumed.count !== 1) {
      request.log.info({ serverId: server.id, ticketId: ticket.id, reason: 'already_redeemed' }, 'redeem rejected');
      throw reject('already_redeemed');
    }
    request.log.info({ serverId: server.id, ticketId: ticket.id, userId: ticket.userId, gameId: ticket.gameId }, 'ticket redeemed');

    return RedeemTicketResponse.parse({
      allowed: true,
      user: {
        id: ticket.user.id,
        numericId: ticket.user.numericId,
        username: ticket.user.username,
        displayName: ticket.user.displayName ?? ticket.user.username,
      },
      game: { id: ticket.game.id, placeId: ticket.game.placeId },
    });
  });
};

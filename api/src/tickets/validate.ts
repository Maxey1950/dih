import type { Game, GameServer, JoinTicket, User } from '@revival/database';
import { isBanned } from '../auth/session.js';
import { isStale, JOINABLE_STATUSES } from '../servers/policy.js';

export type TicketWithRelations = JoinTicket & { user: User; game: Game; server: GameServer };

export type TicketRejection =
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'already_redeemed'
  | 'banned'
  | 'game_unavailable'
  | 'server_not_accepting';

/**
 * Checks shared by launcher resolve and server redemption. Returns the reason
 * a ticket cannot be used right now, or null if it is usable. Expiry is
 * checked here on every read; cleanup jobs are never required for safety.
 */
export function ticketProblem(t: TicketWithRelations, now = new Date()): TicketRejection | null {
  if (t.revokedAt) return 'revoked';
  if (t.redeemedAt) return 'already_redeemed';
  if (t.expiresAt <= now) return 'expired';
  if (isBanned(t.user, now)) return 'banned';
  const game = t.game;
  const viewerMayJoin = game.isPublic || game.creatorId === t.userId || t.user.role === 'admin';
  if (game.deletedAt || !viewerMayJoin || t.server.gameId !== game.id) return 'game_unavailable';
  // A server that stopped heartbeating, is draining or went offline takes no new players.
  if (!(JOINABLE_STATUSES as readonly string[]).includes(t.server.status) || isStale(t.server.lastHeartbeatAt, now)) {
    return 'server_not_accepting';
  }
  return null;
}

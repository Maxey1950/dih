import { createHash, randomBytes } from 'node:crypto';
import { buildLaunchUrl } from '@revival/shared';
import type { GameServer, PrismaClient } from '@revival/database';
import { AppError } from '../errors.js';
import { JOINABLE_STATUSES, staleCutoff } from '../servers/policy.js';

/**
 * Join tickets: one-time, short-lived authorization for ONE user to join
 * ONE game on ONE selected game server.
 *
 * - Format: "rvjt_" + 32 random bytes base64url (256 bits).
 * - Storage: SHA-256 hex only (join_tickets.token_hash, CHECK-constrained).
 * - TTL: TICKET_TTL_SECONDS (90 s) from issuance, checked on every read.
 * - The launcher may resolve a ticket up to MAX_RESOLVES times (does not
 *   consume it); the game server redeems it exactly once (atomic update).
 * - Issuing a ticket revokes the user's other unused tickets, so each user has
 *   at most one live ticket.
 */
export const TICKET_PREFIX = 'rvjt_';
export const TICKET_TTL_SECONDS = 90;
export const MAX_RESOLVES = 3;

export function generateTicket(): string {
  return TICKET_PREFIX + randomBytes(32).toString('base64url');
}

export function hashTicket(ticket: string): string {
  return createHash('sha256').update(ticket, 'utf8').digest('hex');
}

/** Unused, unexpired, unrevoked tickets hold a seat on their server until they lapse. */
export function pendingTicketWhere(now = new Date()) {
  return { redeemedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

/**
 * Server selection policy:
 *  1. candidates: this game's servers with status ONLINE and a heartbeat newer
 *     than the stale cutoff (draining/starting/offline/stale are never chosen);
 *  2. effective load = reported playerCount + pending (unredeemed, unexpired)
 *     tickets for that server, so bursts of joins don't overfill one server;
 *  3. drop servers with effective load >= maxPlayers;
 *  4. pick the lowest occupancy ratio (load / maxPlayers), then the fewest
 *     players, then the server id (deterministic).
 * No geography yet. The game server remains the final authority on capacity.
 */
export async function selectServer(prisma: PrismaClient, gameId: string, now = new Date()): Promise<GameServer> {
  const candidates = await prisma.gameServer.findMany({
    where: { gameId, status: { in: [...JOINABLE_STATUSES] }, lastHeartbeatAt: { gte: staleCutoff(now) } },
  });
  if (candidates.length === 0) {
    throw new AppError(503, 'NO_AVAILABLE_SERVER', 'No servers are running for this game right now.');
  }
  const pending = await prisma.joinTicket.groupBy({
    by: ['serverId'],
    where: { serverId: { in: candidates.map((s) => s.id) }, ...pendingTicketWhere(now) },
    _count: { _all: true },
  });
  const reserved = new Map(pending.map((p) => [p.serverId, p._count._all]));
  const open = candidates
    .map((s) => ({ s, load: s.playerCount + (reserved.get(s.id) ?? 0) }))
    .filter(({ s, load }) => load < s.maxPlayers)
    .sort((a, b) => a.load / a.s.maxPlayers - b.load / b.s.maxPlayers || a.load - b.load || (a.s.id < b.s.id ? -1 : 1));
  if (open.length === 0) {
    throw new AppError(409, 'SERVERS_FULL', 'All servers for this game are full. Please try again shortly.');
  }
  return open[0]!.s;
}

/** Create a ticket for (user, game) on a selected server. Returns the raw ticket ONCE. */
export async function issueTicket(prisma: PrismaClient, userId: string, gameId: string) {
  const now = new Date();
  const server = await selectServer(prisma, gameId, now);
  const ticket = generateTicket();
  const expiresAt = new Date(now.getTime() + TICKET_TTL_SECONDS * 1000);
  const [, row] = await prisma.$transaction([
    // At most one live ticket per user: revoke any older unused ones.
    prisma.joinTicket.updateMany({ where: { userId, ...pendingTicketWhere(now) }, data: { revokedAt: now } }),
    prisma.joinTicket.create({
      data: { tokenHash: hashTicket(ticket), userId, gameId, serverId: server.id, expiresAt },
      select: { id: true, expiresAt: true },
    }),
  ]);
  return { ticket, ticketId: row.id, serverId: server.id, expiresAt: row.expiresAt, launchUrl: buildLaunchUrl(ticket) };
}

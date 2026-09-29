import type { Prisma } from '@revival/database';

/**
 * Central liveness policy for game servers. Everything that asks "is this
 * server alive?" (public player counts, server lists, the admin view, the
 * reaper, and Phase 4 matchmaking) must use these definitions.
 *
 * - Servers heartbeat every HEARTBEAT_INTERVAL_SECONDS (30 s).
 * - A server whose last heartbeat is older than STALE_AFTER_SECONDS (90 s,
 *   i.e. three missed heartbeats) is stale: it is ignored everywhere,
 *   whatever its stored status says.
 * - `npm run servers:reap` marks stale servers `offline` in the database;
 *   that is only housekeeping, since reads apply the cutoff themselves.
 */
export const HEARTBEAT_INTERVAL_SECONDS = 30;
export const STALE_AFTER_SECONDS = 90;

/** Statuses whose players count toward public player counts. */
export const COUNTED_STATUSES = ['online', 'draining'] as const;
/** Statuses eligible for new players (Phase 4 matchmaking). */
export const JOINABLE_STATUSES = ['online'] as const;

export function staleCutoff(now = new Date()): Date {
  return new Date(now.getTime() - STALE_AFTER_SECONDS * 1000);
}

export function isStale(lastHeartbeatAt: Date | null, now = new Date()): boolean {
  return !lastHeartbeatAt || lastHeartbeatAt < staleCutoff(now);
}

/** Prisma filter: servers that are live and count toward player totals. */
export function countedServerWhere(now = new Date()): Prisma.GameServerWhereInput {
  return { status: { in: [...COUNTED_STATUSES] }, lastHeartbeatAt: { gte: staleCutoff(now) } };
}

import type { PrismaClient } from '@revival/database';

export const EXPIRED_GRACE_MS = 60 * 60 * 1000;
export const USED_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes join tickets that can never be used again:
 *   - expired more than 1 hour ago;
 *   - redeemed or revoked more than 24 hours ago (kept briefly for troubleshooting).
 * An ACTIVE ticket (not expired, not redeemed, not revoked) matches none of
 * these, and the explicit guard below makes that unconditional. A single
 * DELETE ... WHERE statement is idempotent, so concurrent runs are safe: each
 * row is deleted at most once and a run never sees a half-applied state.
 * Security never depends on this job; every read checks expiry/redemption/revocation.
 */
export async function cleanupTickets(prisma: PrismaClient, now = new Date()): Promise<number> {
  const expiredBefore = new Date(now.getTime() - EXPIRED_GRACE_MS);
  const usedBefore = new Date(now.getTime() - USED_RETENTION_MS);
  const { count } = await prisma.joinTicket.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: expiredBefore } }, { redeemedAt: { lt: usedBefore } }, { revokedAt: { lt: usedBefore } }],
      // Never an active ticket, whatever the clock or data looks like.
      NOT: { AND: [{ expiresAt: { gt: now } }, { redeemedAt: null }, { revokedAt: null }] },
    },
  });
  return count;
}

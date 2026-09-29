import { Prisma, type PrismaClient } from '@revival/database';
import { COUNTED_STATUSES, countedServerWhere, staleCutoff } from '../servers/policy.js';

/**
 * Live player counts for many games in ONE query (no N+1): SUM(player_count)
 * over counted (online/draining), non-stale servers, grouped by game.
 */
export async function livePlayerCounts(prisma: PrismaClient, gameIds: string[]): Promise<Map<string, number>> {
  if (gameIds.length === 0) return new Map();
  const rows = await prisma.gameServer.groupBy({
    by: ['gameId'],
    where: { gameId: { in: gameIds }, ...countedServerWhere() },
    _sum: { playerCount: true },
  });
  return new Map(rows.map((r) => [r.gameId, r._sum.playerCount ?? 0]));
}

/**
 * Page of public game ids ordered by live player count (then recently
 * updated). Done in SQL so pagination is correct; one query.
 */
export async function publicGameIdsByPlayers(prisma: PrismaClient, skip: number, take: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT g.id
    FROM games g
    LEFT JOIN (
      SELECT s.game_id, SUM(s.player_count)::int AS players
      FROM game_servers s
      WHERE s.status::text IN (${Prisma.join([...COUNTED_STATUSES])})
        AND s.last_heartbeat_at >= ${staleCutoff()}
      GROUP BY s.game_id
    ) live ON live.game_id = g.id
    WHERE g.is_public = true AND g.deleted_at IS NULL
    ORDER BY COALESCE(live.players, 0) DESC, g.updated_at DESC, g.id
    OFFSET ${skip} LIMIT ${take}
  `);
  return rows.map((r) => r.id);
}

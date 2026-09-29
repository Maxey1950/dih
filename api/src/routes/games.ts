import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  CreateGameRequest,
  GameListResponse,
  GameResponse,
  GameServerListResponse,
  GameSort,
  UpdateGameRequest,
} from '@revival/shared';
import type { Game as DbGame, Prisma, User } from '@revival/database';
import { errors } from '../errors.js';
import { PageQuery, parse } from '../validate.js';
import { authOf, requireAuth } from '../auth/guards.js';
import { livePlayerCounts, publicGameIdsByPlayers } from '../games/aggregate.js';
import { toGame, toGameSummary } from '../games/serialize.js';
import { countedServerWhere } from '../servers/policy.js';

const ListQuery = PageQuery.extend({
  sort: GameSort.default('featured'),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});

const GameIdParam = z.object({ id: z.uuid() });
function parseGameId(params: unknown): string {
  const r = GameIdParam.safeParse(params);
  if (!r.success) throw errors.notFound('Game not found');
  return r.data.id;
}

const isAdmin = (u: User | undefined) => u?.role === 'admin';
const isOwner = (g: DbGame, u: User | undefined) => !!u && g.creatorId === u.id;

/** Deleted games: admins only. Private games: creator and admins. */
function canView(g: DbGame, viewer: User | undefined): boolean {
  if (g.deletedAt) return isAdmin(viewer);
  return g.isPublic || isOwner(g, viewer) || isAdmin(viewer);
}

function canEdit(g: DbGame, viewer: User | undefined): boolean {
  if (isAdmin(viewer)) return true;
  return !g.deletedAt && isOwner(g, viewer);
}

const PUBLIC_WHERE: Prisma.GameWhereInput = { isPublic: true, deletedAt: null };

function pageOf(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export const gameRoutes: FastifyPluginAsync = async (app) => {
  const { prisma } = app;

  async function loadGame(id: string) {
    const game = await prisma.game.findUnique({ where: { id }, include: { creator: true } });
    if (!game) throw errors.notFound('Game not found');
    return game;
  }

  // ---- Public list ---------------------------------------------------------
  app.get('/api/games', async (request) => {
    const { sort, page, limit } = parse(ListQuery, request.query);
    const skip = (page - 1) * limit;
    const total = await prisma.game.count({ where: PUBLIC_WHERE });

    let games;
    if (sort === 'players') {
      const ids = await publicGameIdsByPlayers(prisma, skip, limit);
      const rows = await prisma.game.findMany({ where: { id: { in: ids } }, include: { creator: true } });
      const byId = new Map(rows.map((g) => [g.id, g]));
      games = ids.map((id) => byId.get(id)).filter((g) => g !== undefined);
    } else {
      games = await prisma.game.findMany({
        where: PUBLIC_WHERE,
        include: { creator: true },
        orderBy:
          sort === 'updated'
            ? [{ updatedAt: 'desc' }, { id: 'asc' }]
            : [{ isFeatured: 'desc' }, { visits: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      });
    }

    const counts = await livePlayerCounts(prisma, games.map((g) => g.id));
    return GameListResponse.parse({
      games: games.map((g) => toGameSummary(g, counts.get(g.id) ?? 0)),
      ...pageOf(page, limit, total),
    });
  });

  // ---- A user's games (profile "Places", /create "My Places") -------------
  app.get('/api/users/:id/games', async (request) => {
    const r = z.object({ id: z.uuid() }).safeParse(request.params);
    if (!r.success) throw errors.notFound('User not found');
    const userId = r.data.id;
    const { page, limit } = parse(ListQuery.omit({ sort: true }), request.query);
    const viewer = request.auth?.user;
    const own = viewer?.id === userId;
    // Owners also see their private games; nobody sees deleted games here.
    const where: Prisma.GameWhereInput = { creatorId: userId, deletedAt: null, ...(own ? {} : { isPublic: true }) };
    const [total, games] = await prisma.$transaction([
      prisma.game.count({ where }),
      prisma.game.findMany({
        where,
        include: { creator: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const counts = await livePlayerCounts(prisma, games.map((g) => g.id));
    return GameListResponse.parse({
      games: games.map((g) => toGameSummary(g, counts.get(g.id) ?? 0)),
      ...pageOf(page, limit, total),
    });
  });

  // ---- Detail ---------------------------------------------------------------
  app.get('/api/games/:id', async (request) => {
    const game = await loadGame(parseGameId(request.params));
    const viewer = request.auth?.user;
    if (!canView(game, viewer)) throw errors.notFound('Game not found');
    const counts = await livePlayerCounts(prisma, [game.id]);
    return GameResponse.parse({ game: toGame(game, counts.get(game.id) ?? 0, canEdit(game, viewer)) });
  });

  // ---- Live servers (public view: no host/port/credentials) ----------------
  app.get('/api/games/:id/servers', async (request) => {
    const game = await loadGame(parseGameId(request.params));
    if (!canView(game, request.auth?.user)) throw errors.notFound('Game not found');
    const servers = await prisma.gameServer.findMany({
      where: { gameId: game.id, ...countedServerWhere() },
      select: { id: true, playerCount: true, maxPlayers: true, status: true },
      orderBy: [{ playerCount: 'desc' }, { id: 'asc' }],
      take: 100,
    });
    return GameServerListResponse.parse({ servers });
  });

  // ---- Create ---------------------------------------------------------------
  app.post(
    '/api/games',
    { preHandler: requireAuth, config: { rateLimit: { max: app.config.RATE_LIMIT_GAME_CREATE_MAX, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const viewer = authOf(request).user;
      const input = parse(CreateGameRequest, request.body);
      const game = await prisma.game.create({
        // The creator always comes from the session, never from the request.
        data: { ...input, genre: input.genre ?? null, creatorId: viewer.id },
        include: { creator: true },
      });
      reply.code(201);
      return GameResponse.parse({ game: toGame(game, 0, true) });
    }
  );

  // ---- Update (owner or admin) ---------------------------------------------
  app.patch('/api/games/:id', { preHandler: requireAuth }, async (request) => {
    const viewer = authOf(request).user;
    const game = await loadGame(parseGameId(request.params));
    if (!canView(game, viewer)) throw errors.notFound('Game not found');
    if (!canEdit(game, viewer)) throw errors.forbidden('You can only edit your own games.');
    const patch = parse(UpdateGameRequest, request.body);
    if (patch.isFeatured !== undefined && !isAdmin(viewer)) throw errors.forbidden('Only admins can feature games.');
    const updated = await prisma.game.update({ where: { id: game.id }, data: patch, include: { creator: true } });
    const counts = await livePlayerCounts(prisma, [updated.id]);
    return GameResponse.parse({ game: toGame(updated, counts.get(updated.id) ?? 0, true) });
  });

  // ---- Delete = soft delete (unpublish + hide), owner or admin -------------
  app.delete('/api/games/:id', { preHandler: requireAuth }, async (request) => {
    const viewer = authOf(request).user;
    const game = await loadGame(parseGameId(request.params));
    if (!canView(game, viewer)) throw errors.notFound('Game not found');
    if (!canEdit(game, viewer)) throw errors.forbidden('You can only delete your own games.');
    await prisma.game.update({ where: { id: game.id }, data: { deletedAt: new Date(), isPublic: false, isFeatured: false } });
    return { ok: true };
  });
};

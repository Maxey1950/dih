import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  FriendRequestsResponse,
  SettingsResponse,
  UpdateMeRequest,
  UserListResponse,
  UserProfileResponse,
  UserSearchResponse,
  normalizeUsername,
  type FriendshipState,
} from '@revival/shared';
import type { Prisma, PrismaClient } from '@revival/database';
import { errors } from '../errors.js';
import { PageQuery, parse, parseId } from '../validate.js';
import { authOf, requireAuth } from '../auth/guards.js';
import { toCurrentUser, toPublicUser, toUserSummary } from '../users/serialize.js';

const SearchQuery = PageQuery.extend({
  // Only characters that can appear in a username, so the LIKE pattern stays simple.
  search: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9_]*$/, 'Search may contain letters, numbers and underscores')
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

function pageOf(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function ensureUserExists(prisma: PrismaClient, id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw errors.notFound('User not found');
  return user;
}

/** Friendship rows store each pair once with the lower uuid first (see schema). */
export function pairOf(a: string, b: string) {
  return a < b ? { userLowId: a, userHighId: b } : { userLowId: b, userHighId: a };
}

export function acceptedFriendsWhere(userId: string): Prisma.FriendshipWhereInput {
  return { status: 'accepted', OR: [{ userLowId: userId }, { userHighId: userId }] };
}

export const userRoutes: FastifyPluginAsync = async (app) => {
  const { prisma } = app;

  // ---- People search -------------------------------------------------------
  app.get('/api/users', async (request) => {
    const { search, page, limit } = parse(SearchQuery, request.query);
    const where: Prisma.UserWhereInput = search ? { usernameNormalized: { contains: normalizeUsername(search) } } : {};
    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ lastOnlineAt: { sort: 'desc', nulls: 'last' } }, { usernameNormalized: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return UserSearchResponse.parse({ users: users.map(toUserSummary), ...pageOf(page, limit, total) });
  });

  // ---- Current user --------------------------------------------------------
  app.get('/api/users/me/settings', { preHandler: requireAuth }, async (request) => {
    const { user } = authOf(request);
    return SettingsResponse.parse({
      settings: {
        username: user.username,
        displayName: user.displayName,
        description: user.description,
        theme: user.theme,
      },
    });
  });

  app.patch('/api/users/me', { preHandler: requireAuth }, async (request) => {
    const { user } = authOf(request);
    const patch = parse(UpdateMeRequest, request.body);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
      },
    });
    return { user: toCurrentUser(updated) };
  });

  app.get('/api/users/me/friend-requests', { preHandler: requireAuth }, async (request) => {
    const me = authOf(request).user.id;
    const pending = await prisma.friendship.findMany({
      where: { status: 'pending', requesterId: { not: me }, OR: [{ userLowId: me }, { userHighId: me }] },
      include: { requester: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return FriendRequestsResponse.parse({
      requests: pending.map((f) => ({ user: toUserSummary(f.requester), createdAt: f.createdAt.toISOString() })),
    });
  });

  // ---- Public profile ------------------------------------------------------
  app.get('/api/users/:id', async (request) => {
    const id = parseId(request.params);
    const user = await ensureUserExists(prisma, id);

    const [friendCount, followerCount, followingCount] = await prisma.$transaction([
      prisma.friendship.count({ where: acceptedFriendsWhere(id) }),
      prisma.follow.count({ where: { followingId: id } }),
      prisma.follow.count({ where: { followerId: id } }),
    ]);

    let relationship: { friendship: FriendshipState; isFollowing: boolean } | null = null;
    const viewer = request.auth?.user;
    if (viewer && viewer.id !== id) {
      const [friendship, follow] = await Promise.all([
        prisma.friendship.findUnique({ where: { userLowId_userHighId: pairOf(viewer.id, id) } }),
        prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: id } } }),
      ]);
      relationship = {
        friendship: friendship
          ? {
              status: friendship.status,
              direction: friendship.status === 'pending' ? (friendship.requesterId === viewer.id ? 'outgoing' : 'incoming') : null,
            }
          : { status: 'none', direction: null },
        isFollowing: !!follow,
      };
    }

    return UserProfileResponse.parse({
      user: toPublicUser(user),
      stats: { friendCount, followerCount, followingCount },
      relationship,
    });
  });

  // ---- Relationship lists --------------------------------------------------
  app.get('/api/users/:id/friends', async (request) => {
    const id = parseId(request.params);
    const { page, limit } = parse(PageQuery, request.query);
    await ensureUserExists(prisma, id);
    const where = acceptedFriendsWhere(id);
    const [total, rows] = await prisma.$transaction([
      prisma.friendship.count({ where }),
      prisma.friendship.findMany({
        where,
        include: { userLow: true, userHigh: true },
        orderBy: { acceptedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const users = rows.map((f) => toUserSummary(f.userLowId === id ? f.userHigh : f.userLow));
    return UserListResponse.parse({ users, ...pageOf(page, limit, total) });
  });

  app.get('/api/users/:id/followers', async (request) => {
    const id = parseId(request.params);
    const { page, limit } = parse(PageQuery, request.query);
    await ensureUserExists(prisma, id);
    const where = { followingId: id };
    const [total, rows] = await prisma.$transaction([
      prisma.follow.count({ where }),
      prisma.follow.findMany({ where, include: { follower: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return UserListResponse.parse({ users: rows.map((f) => toUserSummary(f.follower)), ...pageOf(page, limit, total) });
  });

  app.get('/api/users/:id/following', async (request) => {
    const id = parseId(request.params);
    const { page, limit } = parse(PageQuery, request.query);
    await ensureUserExists(prisma, id);
    const where = { followerId: id };
    const [total, rows] = await prisma.$transaction([
      prisma.follow.count({ where }),
      prisma.follow.findMany({ where, include: { following: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return UserListResponse.parse({ users: rows.map((f) => toUserSummary(f.following)), ...pageOf(page, limit, total) });
  });
};

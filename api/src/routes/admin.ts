import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AdminUserListResponse, normalizeUsername } from '@revival/shared';
import type { Prisma } from '@revival/database';
import { PageQuery, parse } from '../validate.js';
import { requireAdmin } from '../auth/guards.js';
import { isBanned } from '../auth/session.js';
import { toUserSummary } from '../users/serialize.js';

const Query = PageQuery.extend({
  search: z.string().trim().max(20).regex(/^[A-Za-z0-9_]*$/).optional(),
});

/** Read-only admin endpoints. Admin *actions* (ban, role changes) come in a later phase. */
export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/users', { preHandler: requireAdmin }, async (request) => {
    const { search, page, limit } = parse(Query, request.query);
    const where: Prisma.UserWhereInput = search ? { usernameNormalized: { contains: normalizeUsername(search) } } : {};
    const [total, users] = await app.prisma.$transaction([
      app.prisma.user.count({ where }),
      app.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return AdminUserListResponse.parse({
      users: users.map((u) => ({
        ...toUserSummary(u),
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        isBanned: isBanned(u),
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });
};

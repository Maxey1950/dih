import type { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@revival/database';
import { errors } from '../errors.js';
import { parseId } from '../validate.js';
import { authOf, requireAuth } from '../auth/guards.js';
import { ensureUserExists, pairOf } from './users.js';

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Friends and follows. Every action has its own explicit route; nothing is
 * dispatched from a user-supplied action name. The database enforces the
 * invariants too (unique pair, no self-friendship, no self-follow, unique follow).
 */
export const socialRoutes: FastifyPluginAsync = async (app) => {
  const { prisma } = app;
  const opts = { preHandler: requireAuth };

  // Send a friend request to :id.
  app.post('/api/friends/:id/request', opts, async (request, reply) => {
    const me = authOf(request).user.id;
    const other = parseId(request.params);
    if (other === me) throw errors.badRequest('You cannot send a friend request to yourself.');
    await ensureUserExists(prisma, other);

    const pair = pairOf(me, other);
    const existing = await prisma.friendship.findUnique({ where: { userLowId_userHighId: pair } });
    if (existing?.status === 'accepted') throw errors.conflict('You are already friends.');
    if (existing?.requesterId === me) throw errors.conflict('Friend request already sent.');
    if (existing) throw errors.conflict('This user has already sent you a friend request.');

    try {
      await prisma.friendship.create({ data: { ...pair, requesterId: me } });
    } catch (err) {
      if (isUniqueViolation(err)) throw errors.conflict('Friend request already exists.');
      throw err;
    }
    reply.code(201);
    return { friendship: { status: 'pending', direction: 'outgoing' } };
  });

  // Accept the pending request that :id sent to me.
  app.post('/api/friends/:id/accept', opts, async (request) => {
    const me = authOf(request).user.id;
    const other = parseId(request.params);
    // Only the receiver can accept: the row must be pending AND requested by the other user.
    const result = await prisma.friendship.updateMany({
      where: { ...pairOf(me, other), status: 'pending', requesterId: other },
      data: { status: 'accepted', acceptedAt: new Date() },
    });
    if (result.count === 0) throw errors.notFound('No pending friend request from this user.');
    return { friendship: { status: 'accepted', direction: null } };
  });

  // Remove the relationship with :id: unfriend, cancel my request, or decline theirs.
  app.delete('/api/friends/:id', opts, async (request) => {
    const me = authOf(request).user.id;
    const other = parseId(request.params);
    const result = await prisma.friendship.deleteMany({ where: pairOf(me, other) });
    if (result.count === 0) throw errors.notFound('No friendship or request with this user.');
    return { friendship: { status: 'none', direction: null } };
  });

  app.post('/api/users/:id/follow', opts, async (request, reply) => {
    const me = authOf(request).user.id;
    const other = parseId(request.params);
    if (other === me) throw errors.badRequest('You cannot follow yourself.');
    await ensureUserExists(prisma, other);
    try {
      await prisma.follow.create({ data: { followerId: me, followingId: other } });
    } catch (err) {
      if (isUniqueViolation(err)) throw errors.conflict('You are already following this user.');
      throw err;
    }
    reply.code(201);
    return { isFollowing: true };
  });

  app.delete('/api/users/:id/follow', opts, async (request) => {
    const me = authOf(request).user.id;
    const other = parseId(request.params);
    const result = await prisma.follow.deleteMany({ where: { followerId: me, followingId: other } });
    if (result.count === 0) throw errors.notFound('You are not following this user.');
    return { isFollowing: false };
  });
};

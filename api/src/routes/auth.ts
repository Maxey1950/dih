import type { FastifyPluginAsync } from 'fastify';
import { AuthMeResponse, AuthSuccessResponse, LoginRequest, RegisterRequest, normalizeUsername } from '@revival/shared';
import { Prisma } from '@revival/database';
import { AppError, errors } from '../errors.js';
import { parse } from '../validate.js';
import { burnPasswordCheck, hashPassword, needsRehash, verifyPassword } from '../auth/password.js';
import { endSession, isBanned, startSession } from '../auth/session.js';
import { toCurrentUser } from '../users/serialize.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  const authRateLimit = {
    rateLimit: { max: app.config.RATE_LIMIT_AUTH_MAX, timeWindow: app.config.RATE_LIMIT_AUTH_WINDOW },
  };

  /** CSRF token for the X-CSRF-Token header. Also (re)issues the HttpOnly CSRF secret cookie. */
  app.get('/api/auth/csrf', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { csrfToken: reply.generateCsrf() };
  });

  app.get('/api/auth/me', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = request.auth;
    return AuthMeResponse.parse(
      auth ? { authenticated: true, user: toCurrentUser(auth.user) } : { authenticated: false, user: null }
    );
  });

  app.post('/api/auth/register', { config: authRateLimit }, async (request, reply) => {
    const { username, password } = parse(RegisterRequest, request.body);
    const usernameNormalized = normalizeUsername(username);

    const taken = () => new AppError(409, 'USERNAME_TAKEN', 'That username is already taken.');
    if (await app.prisma.user.findUnique({ where: { usernameNormalized }, select: { id: true } })) throw taken();

    const passwordHash = await hashPassword(password);
    let user;
    try {
      // New accounts are always role "user"; there is no id-based privilege.
      user = await app.prisma.user.create({ data: { username, usernameNormalized, passwordHash } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw taken();
      throw err;
    }

    await startSession(app, request, reply, user.id);
    reply.code(201).header('Cache-Control', 'no-store');
    return AuthSuccessResponse.parse({ authenticated: true, user: toCurrentUser(user) });
  });

  app.post('/api/auth/login', { config: authRateLimit }, async (request, reply) => {
    const body = LoginRequest.safeParse(request.body);
    // Malformed input gets the same answer as wrong credentials.
    if (!body.success) throw errors.invalidCredentials();
    const { username, password } = body.data;

    const user = await app.prisma.user.findUnique({ where: { usernameNormalized: normalizeUsername(username) } });
    if (!user) {
      await burnPasswordCheck(password);
      throw errors.invalidCredentials();
    }
    if (!(await verifyPassword(user.passwordHash, password))) throw errors.invalidCredentials();
    if (isBanned(user)) throw errors.forbidden('This account is suspended.');

    if (needsRehash(user.passwordHash)) {
      await app.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
    }

    await startSession(app, request, reply, user.id);
    reply.header('Cache-Control', 'no-store');
    return AuthSuccessResponse.parse({ authenticated: true, user: toCurrentUser(user) });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    // Logging out also revokes the user's unused join tickets.
    if (request.auth) {
      await app.prisma.joinTicket.updateMany({
        where: { userId: request.auth.user.id, redeemedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
    }
    await endSession(app, request, reply);
    reply.header('Cache-Control', 'no-store');
    return { ok: true };
  });
};

import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { PrismaClient, User } from '@revival/database';
import type { Config } from '../config.js';

/**
 * Server-side sessions: the ONE place that turns a cookie into a user.
 *
 * - Token: 32 random bytes (256 bits), base64url, sent only in an HttpOnly cookie.
 * - Database: stores SHA-256(token) in sessions.token_hash, never the token.
 * - Expiry: absolute, SESSION_TTL_DAYS after login. Expired rows are deleted
 *   when seen and by `npm run sessions:cleanup` (see api/README.md).
 * - Presence: users.last_online_at and sessions.last_used_at are written at
 *   most once per PRESENCE_WRITE_INTERVAL_MS per user/session, not on every
 *   request. A user counts as online if seen within ONLINE_WINDOW_MS.
 */
export const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const PRESENCE_WRITE_INTERVAL_MS = 2 * 60 * 1000;
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export interface AuthState {
  user: User;
  sessionId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the session resolver for every /api request; null when logged out. */
    auth: AuthState | null;
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function sessionCookieName(config: Pick<Config, 'COOKIE_SECURE'>): string {
  // __Host- cookies must be Secure, Path=/ and have no Domain, which pins them to this exact host.
  return config.COOKIE_SECURE ? '__Host-session' : 'rv_session';
}

function cookieOptions(config: Config, expires?: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.COOKIE_SECURE,
    path: '/',
    ...(expires ? { expires } : {}),
  };
}

export function isOnline(lastOnlineAt: Date | null, now = Date.now()): boolean {
  return !!lastOnlineAt && now - lastOnlineAt.getTime() < ONLINE_WINDOW_MS;
}

export function isBanned(user: Pick<User, 'bannedUntil'>, now = new Date()): boolean {
  return !!user.bannedUntil && user.bannedUntil > now;
}

/** Create a session for `userId`, set the cookie, and return nothing token-related to the caller. */
export async function startSession(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string
): Promise<void> {
  const { prisma, config } = app;
  // Rotate: a login/registration never reuses the session presented with it.
  await endSession(app, request, reply, { clearCookie: false });

  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const userAgent = request.headers['user-agent']?.slice(0, 256) ?? null;
  const now = new Date();

  await prisma.$transaction([
    prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt, userAgent } }),
    // Opportunistic cleanup of this user's expired sessions.
    prisma.session.deleteMany({ where: { userId, expiresAt: { lte: now } } }),
    prisma.user.update({ where: { id: userId }, data: { lastOnlineAt: now } }),
  ]);

  reply.setCookie(sessionCookieName(config), token, cookieOptions(config, expiresAt));
}

/** Delete the current session (if any) from the database and clear the cookie. */
export async function endSession(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  { clearCookie = true } = {}
): Promise<void> {
  const token = request.cookies[sessionCookieName(app.config)];
  if (token && TOKEN_PATTERN.test(token)) {
    await app.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  request.auth = null;
  if (clearCookie) reply.clearCookie(sessionCookieName(app.config), cookieOptions(app.config));
}

async function resolveSession(prisma: PrismaClient, config: Config, request: FastifyRequest): Promise<AuthState | null> {
  const token = request.cookies[sessionCookieName(config)];
  if (!token || !TOKEN_PATTERN.test(token)) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  const now = new Date();
  if (session.expiresAt <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (isBanned(session.user, now)) return null;

  // Throttled presence writes (fire-and-forget; failures must not break the request).
  const stale = (d: Date | null) => !d || now.getTime() - d.getTime() >= PRESENCE_WRITE_INTERVAL_MS;
  if (stale(session.lastUsedAt)) {
    prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: now } }).catch(() => {});
  }
  if (stale(session.user.lastOnlineAt)) {
    session.user.lastOnlineAt = now;
    prisma.user.update({ where: { id: session.userId }, data: { lastOnlineAt: now } }).catch(() => {});
  }

  return { user: session.user, sessionId: session.id };
}

/** Registers the resolver: every /api/* request gets `request.auth` (optional auth by default). */
export const sessionPlugin = fp(async (app) => {
  app.decorateRequest('auth', null);
  app.addHook('onRequest', async (request) => {
    request.auth = request.url.startsWith('/api/') ? await resolveSession(app.prisma, app.config, request) : null;
  });
});

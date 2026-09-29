import fp from 'fastify-plugin';
import csrf from '@fastify/csrf-protection';
import { AppError } from '../errors.js';

/**
 * CSRF protection for cookie-authenticated, state-changing requests.
 *
 * Design: synchronizer token (the @fastify/csrf-protection "cookie" mode).
 *  1. The API keeps a random CSRF *secret* in a signed, HttpOnly, SameSite=Lax
 *     cookie (`__Host-csrf` in production). JavaScript cannot read it.
 *  2. GET /api/auth/csrf returns a *token* derived from that secret. The web
 *     app keeps it in memory only (not in storage) and sends it back in the
 *     `X-CSRF-Token` header on every POST/PUT/PATCH/DELETE.
 *  3. For every unsafe method the API checks the token against the secret,
 *     and, as defense in depth, rejects requests whose Origin header is
 *     present and not in WEB_ORIGINS.
 *
 * Login and registration are covered too (prevents login CSRF). SameSite=Lax
 * is kept as an extra layer, not relied on alone.
 */
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const csrfPlugin = fp(async (app) => {
  const secure = app.config.COOKIE_SECURE;
  await app.register(csrf, {
    sessionPlugin: '@fastify/cookie',
    cookieKey: secure ? '__Host-csrf' : 'rv_csrf',
    cookieOpts: { path: '/', sameSite: 'lax', httpOnly: true, secure, signed: true },
    getToken: (request) => {
      const header = request.headers['x-csrf-token'];
      return typeof header === 'string' ? header : undefined;
    },
  });

  const allowedOrigins = new Set(app.config.WEB_ORIGINS);

  app.addHook('onRequest', (request, reply, done) => {
    if (!UNSAFE.has(request.method) || !request.url.startsWith('/api/')) return done();
    const origin = request.headers.origin;
    if (origin !== undefined && !allowedOrigins.has(origin)) {
      return done(new AppError(403, 'CSRF_INVALID', 'Request origin not allowed.'));
    }
    app.csrfProtection(request, reply, done);
  });
});

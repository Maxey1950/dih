import type { FastifyPluginAsync } from 'fastify';
import { AuthMeResponse } from '@revival/shared';

/**
 * Auth routes.
 *
 * Phase 1 establishes the contract only. There is no session storage yet, so
 * every request is anonymous. Phase 2 will:
 *   - POST /api/auth/login   verify credentials, create a Session row, and set
 *                            an opaque session id in a Secure, HttpOnly,
 *                            SameSite=Lax cookie (never a JWT readable by JS)
 *   - GET  /api/auth/me      resolve that cookie to a user
 *   - POST /api/auth/logout  delete the Session row and clear the cookie
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/auth/me', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return AuthMeResponse.parse({ authenticated: false, user: null });
  });
};

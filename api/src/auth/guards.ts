import type { FastifyRequest } from 'fastify';
import type { UserRole } from '@revival/database';
import { errors } from '../errors.js';
import type { AuthState } from './session.js';

/**
 * Authorization helpers. Use as route `preHandler`s, or call inside handlers.
 * Permissions come from the user's role only, never from numeric/user ids.
 *
 *   optionalAuth  - request.auth may be null (this is the default for every route)
 *   requireAuth   - 401 unless logged in
 *   requireRole   - 401 unless logged in, 403 unless role is at least `minRole`
 *   requireAdmin  - requireRole('admin')
 */
const RANK: Record<UserRole, number> = { user: 0, moderator: 1, admin: 2 };

export async function optionalAuth(): Promise<void> {}

export async function requireAuth(request: FastifyRequest): Promise<void> {
  if (!request.auth) throw errors.unauthenticated();
}

export function requireRole(minRole: UserRole) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.auth) throw errors.unauthenticated();
    if (RANK[request.auth.user.role] < RANK[minRole]) throw errors.forbidden();
  };
}

export const requireAdmin = requireRole('admin');

/** Narrow request.auth after requireAuth has run. */
export function authOf(request: FastifyRequest): AuthState {
  if (!request.auth) throw errors.unauthenticated();
  return request.auth;
}

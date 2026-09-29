import type { User as DbUser } from '@revival/database';
import { CurrentUser, User, UserSummary } from '@revival/shared';
import { isOnline } from '../auth/session.js';

/**
 * The ONLY functions that turn database users into API output. Fields are
 * copied explicitly (allow-list) and validated against strict shared schemas,
 * so passwordHash, email, sessions or ban details cannot leak by accident.
 */
export function toUserSummary(u: DbUser): UserSummary {
  return UserSummary.parse({
    id: u.id,
    username: u.username,
    displayName: u.displayName ?? u.username,
    description: u.description,
    isOnline: isOnline(u.lastOnlineAt),
    lastOnlineAt: u.lastOnlineAt?.toISOString() ?? null,
  });
}

export function toPublicUser(u: DbUser): User {
  return User.parse({
    ...toUserSummary(u),
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  });
}

export function toCurrentUser(u: DbUser): CurrentUser {
  return CurrentUser.parse({ ...toPublicUser(u), theme: u.theme });
}

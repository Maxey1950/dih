/**
 * Public API contract. These are the JSON shapes that cross the wire between
 * the browser, the API and (later) the launcher. They intentionally contain
 * nothing about RFD internals: no server hosts, ports, join tickets or
 * RCC/runtime details. Those belong to the api<->launcher<->RFD integration,
 * which will get its own internal schemas in Phase 2.
 */
import { z } from 'zod';
import { Description, DisplayName } from './validation.js';

/** Opaque identifier (the database uses UUIDs; clients must not parse them). */
export const Id = z.string().min(1).max(64);

export const UserRole = z.enum(['user', 'moderator', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const Theme = z.enum(['light', 'dark']);
export type Theme = z.infer<typeof Theme>;

/**
 * A user as anyone may see them. Never includes email, password hash, sessions,
 * ban details or other security metadata. `.strict()` makes the API fail loudly
 * (500) instead of leaking a field that was added to the object by mistake.
 */
export const User = z
  .object({
    id: Id,
    username: z.string(),
    displayName: z.string(),
    description: z.string(),
    role: UserRole,
    isOnline: z.boolean(),
    createdAt: z.iso.datetime(),
    lastOnlineAt: z.iso.datetime().nullable(),
  })
  .strict();
export type User = z.infer<typeof User>;

/** Compact user reference used in lists (friends, followers, search results). */
export const UserSummary = User.pick({
  id: true,
  username: true,
  displayName: true,
  description: true,
  isOnline: true,
  lastOnlineAt: true,
}).strict();
export type UserSummary = z.infer<typeof UserSummary>;

/** The logged-in user, as returned by GET /api/auth/me. Adds private preferences. */
export const CurrentUser = User.extend({
  theme: Theme,
}).strict();
export type CurrentUser = z.infer<typeof CurrentUser>;

/** GET /api/auth/me */
export const AuthMeResponse = z.discriminatedUnion('authenticated', [
  z.object({ authenticated: z.literal(true), user: CurrentUser }),
  z.object({ authenticated: z.literal(false), user: z.null() }),
]);
export type AuthMeResponse = z.infer<typeof AuthMeResponse>;

export const GameCreator = z.object({
  id: Id,
  username: z.string(),
});

/** A game/place listing (GET /api/games, GET /api/games/:id). */
export const Game = z.object({
  id: Id,
  name: z.string().min(1).max(100),
  description: z.string().max(4000),
  creator: GameCreator,
  thumbnailUrl: z.string(),
  playerCount: z.number().int().nonnegative(),
  maxPlayers: z.number().int().positive(),
  genre: z.string().optional(),
  visits: z.number().int().nonnegative().optional(),
  upVotes: z.number().int().nonnegative().optional(),
  downVotes: z.number().int().nonnegative().optional(),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});
export type Game = z.infer<typeof Game>;

export const ApiErrorCode = z.enum([
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'INVALID_CREDENTIALS',
  'USERNAME_TAKEN',
  'CSRF_INVALID',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

/** Every non-2xx JSON response from the API has this shape. */
export const ApiError = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

/** GET /health */
export const HealthResponse = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
  version: z.string(),
  time: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

/** POST /api/auth/register, POST /api/auth/login */
export const AuthSuccessResponse = z.object({ authenticated: z.literal(true), user: CurrentUser });
export type AuthSuccessResponse = z.infer<typeof AuthSuccessResponse>;

/** GET /api/auth/csrf */
export const CsrfResponse = z.object({ csrfToken: z.string() });

export const FriendshipState = z.object({
  status: z.enum(['none', 'pending', 'accepted']),
  /** For pending requests: 'outgoing' if the viewer sent it, 'incoming' if they received it. */
  direction: z.enum(['incoming', 'outgoing']).nullable(),
});
export type FriendshipState = z.infer<typeof FriendshipState>;

/** GET /api/users/:id */
export const UserProfileResponse = z.object({
  user: User,
  stats: z.object({
    friendCount: z.number().int().nonnegative(),
    followerCount: z.number().int().nonnegative(),
    followingCount: z.number().int().nonnegative(),
  }),
  /** null when the viewer is logged out or viewing their own profile. */
  relationship: z.object({ friendship: FriendshipState, isFollowing: z.boolean() }).nullable(),
});
export type UserProfileResponse = z.infer<typeof UserProfileResponse>;

export const Page = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});

/** GET /api/users?search=&page=&limit= */
export const UserSearchResponse = Page.extend({ users: z.array(UserSummary) });
export type UserSearchResponse = z.infer<typeof UserSearchResponse>;

export const UserListResponse = Page.extend({ users: z.array(UserSummary) });
export type UserListResponse = z.infer<typeof UserListResponse>;

/** GET /api/users/me/friend-requests */
export const FriendRequestsResponse = z.object({
  requests: z.array(z.object({ user: UserSummary, createdAt: z.iso.datetime() })),
});

/** PATCH /api/users/me */
export const UpdateMeRequest = z
  .object({
    displayName: DisplayName.nullable().optional(),
    description: Description.optional(),
    theme: Theme.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateMeRequest = z.infer<typeof UpdateMeRequest>;

/** GET /api/users/me/settings */
export const SettingsResponse = z.object({
  settings: z.object({
    username: z.string(),
    displayName: z.string().nullable(),
    description: z.string(),
    theme: Theme,
  }),
});

/** GET /api/admin/users */
export const AdminUser = UserSummary.extend({
  role: UserRole,
  createdAt: z.iso.datetime(),
  isBanned: z.boolean(),
}).strict();
export const AdminUserListResponse = Page.extend({ users: z.array(AdminUser) });

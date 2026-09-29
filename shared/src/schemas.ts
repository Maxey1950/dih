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

export const GameCreator = z
  .object({ id: Id, username: z.string(), displayName: z.string() })
  .strict();

/** Card data for game lists (GET /api/games, GET /api/users/:id/games). */
export const GameSummary = z
  .object({
    id: Id,
    name: z.string(),
    creator: GameCreator,
    thumbnailUrl: z.string(),
    /** Sum over ONLINE/DRAINING, non-stale servers. Never stored on the game. */
    playerCount: z.number().int().nonnegative(),
    maxPlayers: z.number().int().positive(),
    genre: z.string().nullable(),
    visits: z.number().int().nonnegative(),
    upVotes: z.number().int().nonnegative(),
    downVotes: z.number().int().nonnegative(),
    isPublic: z.boolean(),
    isFeatured: z.boolean(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type GameSummary = z.infer<typeof GameSummary>;

/** Full game detail (GET /api/games/:id). */
export const Game = GameSummary.extend({
  description: z.string(),
  placeId: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  /** Viewer-specific: true for the creator and admins. */
  canEdit: z.boolean(),
}).strict();
export type Game = z.infer<typeof Game>;

export const GameSort = z.enum(['featured', 'updated', 'players']);
export type GameSort = z.infer<typeof GameSort>;

export const GameListResponse = z.object({
  games: z.array(GameSummary),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});
export type GameListResponse = z.infer<typeof GameListResponse>;

export const GameResponse = z.object({ game: Game });

export const GAME_GENRES = ['Town and City', 'Fantasy', 'Sci-Fi', 'Adventure', 'War', 'Sports', 'Funny'] as const;
export const GameGenre = z.enum(GAME_GENRES);

// eslint-disable-next-line no-control-regex
const GAME_TEXT_CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;
const GameName = z
  .string()
  .transform((v) => v.replace(GAME_TEXT_CONTROL, '').replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1, 'Game name is required').max(50, 'Game name must be at most 50 characters'));
const GameDescription = z
  .string()
  .max(1000, 'Description must be at most 1000 characters')
  .transform((v) => v.replace(GAME_TEXT_CONTROL, '').trim());
const MaxPlayers = z.number().int('Max players must be a whole number').min(1).max(100, 'Max players must be at most 100');

/**
 * POST /api/games. Strict: creatorId, placeId, visits, votes, thumbnails and
 * featured flags cannot be supplied; the creator always comes from the session.
 */
export const CreateGameRequest = z
  .object({
    name: GameName,
    description: GameDescription.default(''),
    maxPlayers: MaxPlayers.default(12),
    isPublic: z.boolean().default(false),
    genre: GameGenre.nullable().optional(),
  })
  .strict();
export type CreateGameRequest = z.infer<typeof CreateGameRequest>;

/** PATCH /api/games/:id. `isFeatured` is accepted only from admins. */
export const UpdateGameRequest = z
  .object({
    name: GameName.optional(),
    description: GameDescription.optional(),
    maxPlayers: MaxPlayers.optional(),
    isPublic: z.boolean().optional(),
    genre: GameGenre.nullable().optional(),
    isFeatured: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateGameRequest = z.infer<typeof UpdateGameRequest>;

/** Public view of a live server: no host, port, credential or internal state. */
export const GameServerPublic = z
  .object({
    id: Id,
    playerCount: z.number().int().nonnegative(),
    maxPlayers: z.number().int().positive(),
    status: z.enum(['online', 'draining']),
  })
  .strict();
export type GameServerPublic = z.infer<typeof GameServerPublic>;

export const GameServerListResponse = z.object({ servers: z.array(GameServerPublic) });

/** Admin view (GET /api/admin/servers). Still no credential hash or address. */
export const AdminGameServer = z
  .object({
    id: Id,
    game: z.object({ id: Id, name: z.string(), placeId: z.number().int() }).strict(),
    status: z.enum(['starting', 'online', 'draining', 'offline']),
    isStale: z.boolean(),
    playerCount: z.number().int().nonnegative(),
    maxPlayers: z.number().int().positive(),
    startedAt: z.iso.datetime().nullable(),
    lastHeartbeatAt: z.iso.datetime().nullable(),
  })
  .strict();
export const AdminGameServerListResponse = z.object({ servers: z.array(AdminGameServer) });

/**
 * INTERNAL: POST /api/internal/servers/:id/heartbeat (game server -> API,
 * authenticated with the server credential, never a user session).
 */
export const ServerHeartbeatRequest = z
  .object({
    playerCount: z.number().int().min(0).max(200),
    maxPlayers: z.number().int().min(1).max(200),
    /** Optional: a server reports 'starting' while it loads, then 'online'. */
    status: z.enum(['starting', 'online']).optional(),
  })
  .strict()
  .refine((v) => v.playerCount <= v.maxPlayers, {
    message: 'playerCount cannot exceed maxPlayers',
    path: ['playerCount'],
  });
export type ServerHeartbeatRequest = z.infer<typeof ServerHeartbeatRequest>;

export const ServerStateResponse = z.object({
  server: z.object({
    id: Id,
    status: z.enum(['starting', 'online', 'draining', 'offline']),
    playerCount: z.number().int().nonnegative(),
    maxPlayers: z.number().int().positive(),
    /** Seconds; send the next heartbeat within this interval. */
    heartbeatIntervalSeconds: z.number().int().positive(),
  }),
});

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

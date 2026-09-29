/**
 * Public API contract. These are the JSON shapes that cross the wire between
 * the browser, the API and (later) the launcher. They intentionally contain
 * nothing about RFD internals: no server hosts, ports, join tickets or
 * RCC/runtime details. Those belong to the api<->launcher<->RFD integration,
 * which will get its own internal schemas in Phase 2.
 */
import { z } from 'zod';

/** Opaque identifier (the database uses UUIDs; clients must not parse them). */
export const Id = z.string().min(1).max(64);

export const UserRole = z.enum(['user', 'moderator', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const Theme = z.enum(['light', 'dark']);
export type Theme = z.infer<typeof Theme>;

/** A user as anyone may see them. Never includes email, password or session data. */
export const User = z.object({
  id: Id,
  username: z.string().min(3).max(20),
  role: UserRole,
  blurb: z.string().max(1000).default(''),
  isOnline: z.boolean().default(false),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime().nullable().default(null),
});
export type User = z.infer<typeof User>;

/** The logged-in user, as returned by GET /api/auth/me. Adds private preferences. */
export const CurrentUser = User.extend({
  theme: Theme.default('light'),
});
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

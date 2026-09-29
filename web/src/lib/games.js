/**
 * Games data access for the web UI.
 *
 * TEMPORARY STATIC ADAPTER (Phase 1). The two games below are sample data so
 * the 2016-style games pages can render; they are NOT the database. Phase 2
 * replaces the bodies of listGames/getGame with:
 *   GET /api/games        -> api.get('/api/games', { query })
 *   GET /api/games/:id    -> api.get(`/api/games/${seg(id)}`)
 * The returned shape must stay the same (see shared/src/schemas.ts `Game`):
 *
 * @typedef {Object} Game
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {{ id: string, username: string }} creator
 * @property {string} thumbnailUrl
 * @property {number} playerCount
 * @property {number} maxPlayers
 * @property {string} [genre]
 * @property {number} [visits]
 * @property {number} [upVotes]
 * @property {number} [downVotes]
 * @property {string} [createdAt]   ISO-8601
 * @property {string} [updatedAt]   ISO-8601
 */

/** @type {Game[]} */
const SAMPLE_GAMES = [
  {
    id: '1',
    name: 'Happy Home in Robloxia',
    description: 'cool',
    creator: { id: '1', username: 'admin' },
    thumbnailUrl: '/images/2010_place.png',
    playerCount: 0,
    maxPlayers: 12,
    genre: 'Town and City',
    visits: 52,
    upVotes: 3,
    downVotes: 1,
    createdAt: '2025-11-12T00:00:00.000Z',
    updatedAt: '2025-11-13T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'My First Place',
    description: 'This is your very first Roblox creation. Check it out, then make it your own with Roblox Studio!',
    creator: { id: '2', username: 'builderman' },
    thumbnailUrl: '/images/default_place.png',
    playerCount: 0,
    maxPlayers: 12,
    genre: 'Town and City',
    visits: 9,
    upVotes: 1,
    downVotes: 0,
    createdAt: '2025-11-12T00:00:00.000Z',
    updatedAt: '2025-11-13T00:00:00.000Z',
  },
];

/** @returns {Promise<Game[]>} */
export async function listGames() {
  return SAMPLE_GAMES.map((g) => ({ ...g }));
}

/** @returns {Promise<Game|null>} */
export async function getGame(id) {
  const game = SAMPLE_GAMES.find((g) => g.id === String(id));
  return game ? { ...game } : null;
}

/** @returns {Promise<Game[]>} */
export async function listGamesByCreator(userId) {
  return SAMPLE_GAMES.filter((g) => g.creator.id === String(userId)).map((g) => ({ ...g }));
}

/** Approval percentage (0-100) from up/down votes. */
export function approvalRating(game) {
  const up = game.upVotes ?? 0;
  const down = game.downVotes ?? 0;
  return Math.round((up / Math.max(up + down, 1)) * 100);
}

/**
 * THE single integration point for joining a game.
 *
 * Phase 2 replaces the body with:
 *   const { launchUrl } = await api.post(`/api/games/${seg(gameId)}/join`, {});
 *   // launchUrl must match ^ourrevival://join\?ticket=[A-Za-z0-9_-]+$
 *   window.location.href = launchUrl;
 *   return { ok: true };
 *
 * No tickets are created in Phase 1.
 *
 * @param {string} gameId
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'launcher_unavailable', message: string }>}
 */
export async function playGame(gameId) {
  return {
    ok: false,
    reason: 'launcher_unavailable',
    message: 'The game launcher is not available yet. Joining games will be enabled in a future update.',
  };
}

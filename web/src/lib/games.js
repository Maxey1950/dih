/**
 * Games helpers for the web UI. Data comes from the API (see gamesApi in lib/api.js).
 */
import { ApiError, gamesApi } from './api';

/** Approval percentage (0-100) from up/down votes. */
export function approvalRating(game) {
  const up = game.upVotes ?? 0;
  const down = game.downVotes ?? 0;
  return Math.round((up / Math.max(up + down, 1)) * 100);
}

/** The only URL shape we will ever hand to the OS: ourrevival://join?ticket=rvjt_... */
const LAUNCH_URL_PATTERN = /^ourrevival:\/\/join\?ticket=rvjt_[A-Za-z0-9_-]{43}$/;

const MESSAGES = {
  UNAUTHENTICATED: 'Please log in to play.',
  NO_AVAILABLE_SERVER: 'No servers are running for this game right now. Please try again later.',
  SERVERS_FULL: 'All servers for this game are full. Please try again shortly.',
  RATE_LIMITED: 'You are joining too quickly. Please wait a moment and try again.',
  NOT_FOUND: 'This game is not available.',
};

/**
 * THE single integration point for joining a game.
 *
 * 1. POST /api/games/:id/join (session cookie + CSRF). The server picks the
 *    game server and returns a one-time, 90-second ticket; no host or port
 *    ever reaches the browser.
 * 2. Hand `ourrevival://join?ticket=...` to the OS, which starts the launcher.
 *
 * Browsers cannot reliably report whether a custom protocol handler exists,
 * so the caller shows "didn't start? install the launcher" help afterwards.
 *
 * @returns {Promise<{ ok: true, expiresAt: string } | { ok: false, reason: string, message: string }>}
 */
export async function playGame(gameId) {
  let launchUrl;
  let expiresAt;
  try {
    ({ launchUrl, expiresAt } = await gamesApi.join(gameId));
  } catch (err) {
    const code = err instanceof ApiError ? (err.status === 401 ? 'UNAUTHENTICATED' : err.code) : 'NETWORK_ERROR';
    return { ok: false, reason: code, message: MESSAGES[code] || (err instanceof ApiError ? err.message : 'Could not start the game.') };
  }
  if (!LAUNCH_URL_PATTERN.test(launchUrl)) {
    return { ok: false, reason: 'BAD_RESPONSE', message: 'Could not start the game.' };
  }
  window.location.href = launchUrl;
  return { ok: true, expiresAt };
}

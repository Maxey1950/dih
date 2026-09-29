/**
 * Games helpers for the web UI. Data comes from the API (see gamesApi in
 * lib/api.js); the Phase 1 static adapter has been removed.
 */
import { gamesApi } from './api';

/** Approval percentage (0-100) from up/down votes. */
export function approvalRating(game) {
  const up = game.upVotes ?? 0;
  const down = game.downVotes ?? 0;
  return Math.round((up / Math.max(up + down, 1)) * 100);
}

/**
 * THE single integration point for joining a game.
 *
 * Phase 3: checks whether a live server exists, but issues NO ticket and
 * launches nothing. Phase 4 replaces the body with:
 *   const { launchUrl } = await api.post(`/api/games/${seg(gameId)}/join`, {});
 *   // launchUrl must match ^ourrevival://join\?ticket=[A-Za-z0-9_-]+$
 *   window.location.href = launchUrl;
 *
 * @param {string} gameId
 * @returns {Promise<{ ok: false, reason: 'launcher_unavailable', message: string, serversOnline: number }>}
 */
export async function playGame(gameId) {
  let serversOnline = 0;
  try {
    const { servers } = await gamesApi.servers(gameId);
    serversOnline = servers.filter((s) => s.status === 'online').length;
  } catch {
    /* treat as no servers */
  }
  return {
    ok: false,
    reason: 'launcher_unavailable',
    serversOnline,
    message:
      serversOnline > 0
        ? `A server is online for this game. Launcher integration is coming in the next phase.`
        : 'No servers are running for this game right now. Launcher integration is coming in the next phase.',
  };
}

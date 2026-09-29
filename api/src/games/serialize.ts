import type { Game as DbGame, User as DbUser } from '@revival/database';
import { Game, GameSummary } from '@revival/shared';

export const DEFAULT_GAME_THUMBNAIL = '/images/default_place.png';

type GameWithCreator = DbGame & { creator: DbUser };

/** Allow-list serializers. Server rows and internal fields are never included. */
export function toGameSummary(g: GameWithCreator, playerCount: number): GameSummary {
  return GameSummary.parse({
    id: g.id,
    name: g.name,
    creator: { id: g.creator.id, username: g.creator.username, displayName: g.creator.displayName ?? g.creator.username },
    thumbnailUrl: g.thumbnailUrl ?? DEFAULT_GAME_THUMBNAIL,
    playerCount,
    maxPlayers: g.maxPlayers,
    genre: g.genre,
    visits: Number(g.visits),
    upVotes: g.upVotes,
    downVotes: g.downVotes,
    isPublic: g.isPublic,
    isFeatured: g.isFeatured,
    updatedAt: g.updatedAt.toISOString(),
  });
}

export function toGame(g: GameWithCreator, playerCount: number, canEdit: boolean): Game {
  return Game.parse({
    ...toGameSummary(g, playerCount),
    description: g.description,
    placeId: g.placeId,
    createdAt: g.createdAt.toISOString(),
    canEdit,
  });
}

-- Phase 3: database-backed games and the game-server registry.
-- Generated with `prisma migrate diff`, then CHECK constraints added by hand at the end.

-- CreateEnum
CREATE TYPE "GameServerStatus" AS ENUM ('starting', 'online', 'draining', 'offline');

-- DropIndex
DROP INDEX "games_is_public_updated_at_idx";

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "place_id" SERIAL NOT NULL,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(1000);

-- CreateTable
CREATE TABLE "game_servers" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "credential_hash" CHAR(64) NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "port" INTEGER NOT NULL,
    "status" "GameServerStatus" NOT NULL DEFAULT 'offline',
    "player_count" INTEGER NOT NULL DEFAULT 0,
    "max_players" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3),
    "last_heartbeat_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_servers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_servers_credential_hash_key" ON "game_servers"("credential_hash");

-- CreateIndex
CREATE INDEX "game_servers_game_id_status_last_heartbeat_at_idx" ON "game_servers"("game_id", "status", "last_heartbeat_at");

-- CreateIndex
CREATE INDEX "game_servers_status_last_heartbeat_at_idx" ON "game_servers"("status", "last_heartbeat_at");

-- CreateIndex
CREATE UNIQUE INDEX "games_place_id_key" ON "games"("place_id");

-- CreateIndex
CREATE INDEX "games_is_public_deleted_at_updated_at_idx" ON "games"("is_public", "deleted_at", "updated_at");

-- CreateIndex
CREATE INDEX "games_is_featured_idx" ON "games"("is_featured");

-- AddForeignKey
ALTER TABLE "game_servers" ADD CONSTRAINT "game_servers_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added CHECK constraints (not expressible in the Prisma schema).
ALTER TABLE "games" ADD CONSTRAINT "games_max_players_chk" CHECK ("max_players" BETWEEN 1 AND 100);
ALTER TABLE "games" ADD CONSTRAINT "games_name_not_blank_chk" CHECK (length(btrim("name")) > 0);
ALTER TABLE "games" ADD CONSTRAINT "games_counters_chk" CHECK ("visits" >= 0 AND "up_votes" >= 0 AND "down_votes" >= 0);
ALTER TABLE "game_servers" ADD CONSTRAINT "game_servers_port_chk" CHECK ("port" BETWEEN 1 AND 65535);
ALTER TABLE "game_servers" ADD CONSTRAINT "game_servers_players_chk" CHECK ("max_players" BETWEEN 1 AND 200 AND "player_count" >= 0 AND "player_count" <= "max_players");
-- Only a SHA-256 hex digest may be stored, never a raw credential.
ALTER TABLE "game_servers" ADD CONSTRAINT "game_servers_credential_hash_hex_chk" CHECK ("credential_hash" ~ '^[0-9a-f]{64}$');

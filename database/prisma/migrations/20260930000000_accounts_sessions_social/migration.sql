-- Phase 2: accounts, sessions and social graph.
-- Generated with `prisma migrate diff`, then hand-edited (see comments).

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('pending', 'accepted');

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "ip_address",
DROP COLUMN "revoked_at",
ALTER COLUMN "user_agent" SET DATA TYPE VARCHAR(256);

-- AlterTable (hand-edited: rename instead of drop/add so no data is lost)
ALTER TABLE "users" RENAME COLUMN "blurb" TO "description";
ALTER TABLE "users" RENAME COLUMN "last_seen_at" TO "last_online_at";
ALTER TABLE "users" ADD COLUMN "display_name" VARCHAR(32);

-- CreateTable
CREATE TABLE "friendships" (
    "id" UUID NOT NULL,
    "user_low_id" UUID NOT NULL,
    "user_high_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower_id" UUID NOT NULL,
    "following_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","following_id")
);

-- CreateIndex
CREATE INDEX "friendships_user_high_id_idx" ON "friendships"("user_high_id");

-- CreateIndex
CREATE INDEX "friendships_requester_id_idx" ON "friendships"("requester_id");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_user_low_id_user_high_id_key" ON "friendships"("user_low_id", "user_high_id");

-- CreateIndex
CREATE INDEX "follows_following_id_idx" ON "follows"("following_id");

-- CreateIndex
CREATE INDEX "users_last_online_at_idx" ON "users"("last_online_at");

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_low_id_fkey" FOREIGN KEY ("user_low_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_high_id_fkey" FOREIGN KEY ("user_high_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Hand-added CHECK constraints (not expressible in the Prisma schema).
-- Friendship rows store each unordered pair once, low id first; this also
-- makes self-friendship impossible.
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_ordered_pair_chk" CHECK ("user_low_id" < "user_high_id");
-- The requester must be one of the two users.
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_in_pair_chk" CHECK ("requester_id" = "user_low_id" OR "requester_id" = "user_high_id");
-- accepted_at is set exactly when the friendship is accepted.
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_accepted_at_chk" CHECK (("status" = 'accepted') = ("accepted_at" IS NOT NULL));
-- Nobody can follow themselves.
ALTER TABLE "follows" ADD CONSTRAINT "follows_not_self_chk" CHECK ("follower_id" <> "following_id");
-- Session token hashes are hex SHA-256.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_hash_hex_chk" CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

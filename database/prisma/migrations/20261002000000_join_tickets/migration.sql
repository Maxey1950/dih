-- Phase 4: one-time join tickets and stable numeric user ids for the game runtime.
-- Generated with `prisma migrate diff`, then CHECK constraints added by hand at the end.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "numeric_id" SERIAL NOT NULL;

-- CreateTable
CREATE TABLE "join_tickets" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "launcher_resolved_at" TIMESTAMP(3),
    "resolve_count" INTEGER NOT NULL DEFAULT 0,
    "redeemed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "join_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "join_tickets_token_hash_key" ON "join_tickets"("token_hash");

-- CreateIndex
CREATE INDEX "join_tickets_user_id_redeemed_at_revoked_at_expires_at_idx" ON "join_tickets"("user_id", "redeemed_at", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "join_tickets_server_id_redeemed_at_revoked_at_expires_at_idx" ON "join_tickets"("server_id", "redeemed_at", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "join_tickets_expires_at_idx" ON "join_tickets"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_numeric_id_key" ON "users"("numeric_id");

-- AddForeignKey
ALTER TABLE "join_tickets" ADD CONSTRAINT "join_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_tickets" ADD CONSTRAINT "join_tickets_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_tickets" ADD CONSTRAINT "join_tickets_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "game_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added CHECK constraints.
-- Only a SHA-256 hex digest may be stored, never a raw ticket.
ALTER TABLE "join_tickets" ADD CONSTRAINT "join_tickets_token_hash_hex_chk" CHECK ("token_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "join_tickets" ADD CONSTRAINT "join_tickets_expiry_chk" CHECK ("expires_at" > "created_at");
ALTER TABLE "join_tickets" ADD CONSTRAINT "join_tickets_resolve_count_chk" CHECK ("resolve_count" >= 0);

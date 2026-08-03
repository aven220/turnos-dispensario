-- AlterTable: make window_id optional, add participant_id and delivered_at
ALTER TABLE "chat_messages" ALTER COLUMN "window_id" DROP NOT NULL;

ALTER TABLE "chat_messages" ADD COLUMN "participant_id" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN "delivered_at" TIMESTAMP(3);

-- Backfill participant from window primary operator when possible
UPDATE "chat_messages" cm
SET "participant_id" = wo."user_id"
FROM "window_operators" wo
WHERE wo."window_id" = cm."window_id"
  AND cm."participant_id" IS NULL;

-- Fallback: use sender if sender is not admin and participant still null
UPDATE "chat_messages" cm
SET "participant_id" = cm."sender_id"
FROM "users" u
WHERE u.id = cm."sender_id"
  AND u.role <> 'ADMIN'
  AND cm."participant_id" IS NULL;

-- For remaining orphans (admin-only threads without operator), use a placeholder skip — delete impossible rows without participant
DELETE FROM "chat_messages" WHERE "participant_id" IS NULL;

ALTER TABLE "chat_messages" ALTER COLUMN "participant_id" SET NOT NULL;

CREATE INDEX "chat_messages_participant_id_created_at_idx" ON "chat_messages"("participant_id", "created_at");
CREATE INDEX "chat_messages_participant_id_read_at_idx" ON "chat_messages"("participant_id", "read_at");

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

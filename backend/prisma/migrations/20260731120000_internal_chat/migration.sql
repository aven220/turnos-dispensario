-- CreateTable
CREATE TABLE "chat_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "chat_enabled" BOOLEAN NOT NULL DEFAULT true,
    "chat_sound_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "chat_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "window_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ticket_id" TEXT,
    "ticket_display_code" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_window_id_created_at_idx" ON "chat_messages"("window_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_window_id_read_at_idx" ON "chat_messages"("window_id", "read_at");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_window_id_fkey" FOREIGN KEY ("window_id") REFERENCES "windows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default settings
INSERT INTO "chat_settings" ("id", "chat_enabled", "chat_sound_enabled") VALUES ('default', true, true);

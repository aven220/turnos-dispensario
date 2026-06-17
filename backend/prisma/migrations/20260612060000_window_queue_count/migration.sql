ALTER TABLE "tv_settings" ADD COLUMN "window_queue_count" INTEGER NOT NULL DEFAULT 3;

UPDATE "tv_settings" SET "window_queue_count" = 3 WHERE "window_queue_count" IS NULL;

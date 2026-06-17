ALTER TABLE "tv_settings" ADD COLUMN "speech_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.9;
ALTER TABLE "tv_settings" ADD COLUMN "speech_voice" TEXT NOT NULL DEFAULT '';
ALTER TABLE "tv_settings" ADD COLUMN "speech_lang" TEXT NOT NULL DEFAULT 'es-ES';

UPDATE "tv_settings"
SET "speech_rate" = 0.9, "speech_voice" = '', "speech_lang" = 'es-ES'
WHERE "speech_rate" IS NULL OR "speech_voice" IS NULL OR "speech_lang" IS NULL;

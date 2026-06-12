ALTER TABLE "tv_settings" ADD COLUMN "welcome_message" TEXT NOT NULL DEFAULT 'BIENVENIDOS A CENCOIC';

UPDATE "tv_settings" SET "welcome_message" = 'BIENVENIDOS A CENCOIC' WHERE "welcome_message" IS NULL;

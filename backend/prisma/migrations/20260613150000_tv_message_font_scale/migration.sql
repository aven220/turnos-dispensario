-- Tamaño del mensaje superior (bienvenida) y ticker inferior en pantalla TV
ALTER TABLE "tv_settings" ADD COLUMN "welcome_font_scale" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "tv_settings" ADD COLUMN "ticker_font_scale" DOUBLE PRECISION NOT NULL DEFAULT 1;

UPDATE "tv_settings" SET "welcome_font_scale" = 1 WHERE "welcome_font_scale" IS NULL;
UPDATE "tv_settings" SET "ticker_font_scale" = 1 WHERE "ticker_font_scale" IS NULL;

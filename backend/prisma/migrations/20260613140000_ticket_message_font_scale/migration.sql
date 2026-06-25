-- Escala de fuente para mensajes del ticket impreso (1 = 100%)
ALTER TABLE "ticket_print_settings" ADD COLUMN "message_font_scale" DOUBLE PRECISION NOT NULL DEFAULT 1;

UPDATE "ticket_print_settings" SET "message_font_scale" = 1 WHERE "message_font_scale" IS NULL;

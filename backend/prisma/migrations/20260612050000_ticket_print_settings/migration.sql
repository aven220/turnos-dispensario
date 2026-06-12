CREATE TABLE "ticket_print_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "header_title" TEXT NOT NULL DEFAULT 'CENCOIC',
    "show_header" BOOLEAN NOT NULL DEFAULT true,
    "show_priority" BOOLEAN NOT NULL DEFAULT true,
    "show_display_code" BOOLEAN NOT NULL DEFAULT true,
    "show_unique_code" BOOLEAN NOT NULL DEFAULT false,
    "show_date_time" BOOLEAN NOT NULL DEFAULT true,
    "show_footer" BOOLEAN NOT NULL DEFAULT true,
    "footer_message" TEXT NOT NULL DEFAULT 'Espere a ser llamado en pantalla',

    CONSTRAINT "ticket_print_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ticket_print_settings" ("id") VALUES ('default') ON CONFLICT DO NOTHING;

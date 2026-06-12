-- CreateTable
CREATE TABLE "tv_settings" (
    "id" TEXT NOT NULL,
    "upcoming_count" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "tv_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "tv_settings" ("id", "upcoming_count") VALUES ('default', 3);

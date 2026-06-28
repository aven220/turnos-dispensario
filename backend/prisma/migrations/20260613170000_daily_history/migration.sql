-- CreateTable
CREATE TABLE "daily_history" (
    "date_prefix" TEXT NOT NULL,
    "generated" INTEGER NOT NULL DEFAULT 0,
    "attended" INTEGER NOT NULL DEFAULT 0,
    "absent" INTEGER NOT NULL DEFAULT 0,
    "cancelled" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "window_summary" JSONB,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_history_pkey" PRIMARY KEY ("date_prefix")
);

-- CreateIndex
CREATE INDEX "daily_history_archived_at_idx" ON "daily_history"("archived_at");

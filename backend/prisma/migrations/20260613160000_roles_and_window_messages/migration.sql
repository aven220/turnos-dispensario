-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'AREA_MANAGER';
ALTER TYPE "UserRole" ADD VALUE 'AUDITOR';

-- CreateEnum
CREATE TYPE "WindowMessageStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "window_messages" (
    "id" TEXT NOT NULL,
    "window_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "WindowMessageStatus" NOT NULL DEFAULT 'PENDING',
    "sent_by_id" TEXT NOT NULL,
    "acknowledged_by_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),

    CONSTRAINT "window_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "window_messages_window_id_status_idx" ON "window_messages"("window_id", "status");

-- AddForeignKey
ALTER TABLE "window_messages" ADD CONSTRAINT "window_messages_window_id_fkey" FOREIGN KEY ("window_id") REFERENCES "windows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "window_messages" ADD CONSTRAINT "window_messages_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "window_messages" ADD CONSTRAINT "window_messages_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

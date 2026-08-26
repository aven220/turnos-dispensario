-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_document_number_key" ON "clients"("document_number");

-- CreateIndex
CREATE INDEX "clients_document_number_idx" ON "clients"("document_number");

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "client_id" TEXT;

-- CreateIndex
CREATE INDEX "tickets_client_id_created_at_idx" ON "tickets"("client_id", "created_at");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

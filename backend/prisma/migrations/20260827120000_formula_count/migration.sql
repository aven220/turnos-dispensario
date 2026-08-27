-- AlterTable: número de fórmulas por turno (histórico = 1 por defecto)
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "formula_count" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: máximo configurable de fórmulas
ALTER TABLE "ticket_print_settings" ADD COLUMN IF NOT EXISTS "max_formulas" INTEGER NOT NULL DEFAULT 1;

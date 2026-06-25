-- Orden de prioridades por ventanilla (cada ventanilla define su propia secuencia)
ALTER TABLE "window_priorities" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Migrar orden existente desde el acomodo global de prioridades
UPDATE "window_priorities" wp
SET "sort_order" = p."sort_order"
FROM "priorities" p
WHERE wp."priority_id" = p."id";

-- Empates: desempatar por id estable
WITH ranked AS (
  SELECT
    wp."id",
    ROW_NUMBER() OVER (
      PARTITION BY wp."window_id"
      ORDER BY wp."sort_order" ASC, wp."id" ASC
    ) AS rn
  FROM "window_priorities" wp
)
UPDATE "window_priorities" wp
SET "sort_order" = ranked.rn
FROM ranked
WHERE wp."id" = ranked."id";

CREATE INDEX "window_priorities_window_id_sort_order_idx" ON "window_priorities"("window_id", "sort_order");

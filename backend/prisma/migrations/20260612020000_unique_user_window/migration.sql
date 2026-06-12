-- Eliminar asignaciones duplicadas (conservar la más reciente por usuario)
DELETE FROM "window_operators" wo
WHERE wo.id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM "window_operators"
  ORDER BY user_id, created_at DESC
);

-- DropIndex
DROP INDEX IF EXISTS "window_operators_window_id_user_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "window_operators_user_id_key" ON "window_operators"("user_id");

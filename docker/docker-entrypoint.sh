#!/bin/sh
set -e

cd /app/backend

echo "Aplicando migraciones..."
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if npx prisma migrate deploy; then
    break
  fi
  if [ "$attempt" -eq 10 ]; then
    echo "Error: no se pudo aplicar migraciones."
    exit 1
  fi
  echo "Esperando base de datos... intento $attempt/10"
  sleep 3
done

USER_COUNT=$(node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const count = await prisma.user.count();
  console.log(count);
} finally {
  await prisma.\$disconnect();
}
" 2>/dev/null || echo "0")

if [ "${SEED_ON_START:-false}" = "true" ] || [ "$USER_COUNT" = "0" ]; then
  echo "Cargando usuarios iniciales (admin, filtro, ventanillas)..."
  npx tsx prisma/seed.ts
else
  echo "Usuarios existentes: $USER_COUNT (seed omitido)."
fi

echo "Iniciando aplicacion..."
exec "$@"

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

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "Cargando datos iniciales..."
  npx tsx prisma/seed.ts
fi

echo "Iniciando aplicacion..."
exec "$@"

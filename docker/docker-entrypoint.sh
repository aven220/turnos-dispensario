#!/bin/sh

cd /app/backend

echo "Aplicando migraciones..."
MIGRATE_OK=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if npx prisma migrate deploy; then
    MIGRATE_OK=1
    break
  fi
  echo "Esperando base de datos... intento $attempt/10"
  sleep 3
done

if [ "$MIGRATE_OK" -ne 1 ]; then
  echo "ERROR: no se pudo aplicar migraciones."
  echo "Revise: docker compose logs postgres"
  exit 1
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "Cargando usuarios iniciales..."
  if npx tsx prisma/seed.ts; then
    echo "Seed completado."
  else
    echo "AVISO: seed fallo. La app arrancara igual; ejecute seed manualmente despues."
  fi
fi

echo "Iniciando aplicacion..."
exec "$@"

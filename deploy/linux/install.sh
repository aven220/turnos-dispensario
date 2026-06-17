#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "============================================"
echo "  INSTALACION - Turnos Dispensario (Linux)"
echo "============================================"

command -v node >/dev/null || { echo "[ERROR] Instale Node.js 20 LTS"; exit 1; }
command -v npm >/dev/null || { echo "[ERROR] npm no encontrado"; exit 1; }

echo "[1/6] Dependencias npm..."
npm install

if [ ! -f backend/.env ]; then
  echo "[2/6] Creando backend/.env desde plantilla..."
  cp deploy/linux/.env.example backend/.env
else
  echo "[2/6] backend/.env ya existe."
fi

if command -v docker >/dev/null 2>&1; then
  echo "[3/6] Iniciando PostgreSQL con Docker..."
  docker compose up -d --wait
else
  echo "[3/6] Docker no detectado. Configure PostgreSQL manualmente en backend/.env"
fi

echo "[4/6] Migraciones..."
npm run db:deploy

echo "[5/6] Datos iniciales..."
npm run db:seed

echo "[6/6] Compilacion..."
npm run build

echo ""
echo "Instalacion completada."
echo "Inicie con: deploy/linux/start.sh"
echo "O con PM2:  deploy/linux/start-pm2.sh"

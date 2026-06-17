#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [ ! -f backend/.env ]; then
  echo "[ERROR] Falta backend/.env. Ejecute deploy/linux/install.sh"
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  docker compose up -d --wait 2>/dev/null || docker compose up -d
fi

export NODE_ENV=production

echo "Compilando..."
npm run build

echo ""
echo "Servidor en http://0.0.0.0:$(grep -E '^PORT=' backend/.env | cut -d= -f2 | tr -d '"' || echo 8741)"
echo "TV: /tv  |  Salud: /api/health"
echo ""

npm run start:server

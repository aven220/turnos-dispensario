#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! command -v pm2 >/dev/null; then
  echo "Instalando PM2 globalmente..."
  npm install -g pm2
fi

if command -v docker >/dev/null 2>&1; then
  docker compose up -d --wait 2>/dev/null || docker compose up -d
fi

export NODE_ENV=production
npm run build

pm2 delete turnos-dispensario 2>/dev/null || true
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save

echo ""
echo "Aplicacion en PM2. Comandos utiles:"
echo "  pm2 status"
echo "  pm2 logs turnos-dispensario"
echo "  pm2 restart turnos-dispensario"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"

export DATABASE_URL="${DATABASE_URL:-postgresql://app:app@localhost:5432/app_finances}"
export DEV_AUTH_BYPASS="${DEV_AUTH_BYPASS:-true}"
export AUTH_SECRET="${AUTH_SECRET:-local-only-auth-secret-change-me}"
export AUTH_URL="${AUTH_URL:-http://localhost:${LOCAL_APP_PORT:-3000}}"

docker compose -f "$COMPOSE_FILE" up -d --wait postgres

cd "$ROOT_DIR"
npm run db:migrate

echo "CRM local disponible en http://localhost:${LOCAL_APP_PORT:-3000}"
exec npm run dev -- --hostname 127.0.0.1 --port "${LOCAL_APP_PORT:-3000}"

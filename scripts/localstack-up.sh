#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"
RUNTIME_ENV="$ROOT_DIR/.localstack/app-nexo.env"

mkdir -p "$ROOT_DIR/.localstack"

if [[ -z "${LOCALSTACK_AUTH_TOKEN:-}" ]]; then
  cat >&2 <<'EOF'
Falta LOCALSTACK_AUTH_TOKEN. Las versiones actuales de LocalStack requieren un
token incluso para el plan Hobby. Créalo en https://app.localstack.cloud y ejecuta:

  export LOCALSTACK_AUTH_TOKEN='...'
  bash scripts/localstack-up.sh

PostgreSQL puede iniciarse sin LocalStack con:
  docker compose -f docker-compose.local.yml up -d --wait postgres
EOF
  exit 2
fi

docker compose -f "$COMPOSE_FILE" up -d --wait

for _ in $(seq 1 60); do
  if [[ -s "$RUNTIME_ENV" ]]; then
    echo "Entorno local listo."
    echo "Variables generadas: $RUNTIME_ENV"
    echo "Prueba AWS local: bash scripts/localstack-smoke.sh"
    echo "Frontend demo:  set -a; source .localstack/app-nexo.env; set +a; npm run dev"
    exit 0
  fi
  sleep 1
done

echo "LocalStack inició, pero el hook de recursos no terminó." >&2
docker compose -f "$COMPOSE_FILE" logs --tail=120 localstack >&2
exit 1

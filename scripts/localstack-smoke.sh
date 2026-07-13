#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"
RUNTIME_ENV="$ROOT_DIR/.localstack/app-finances.env"

if [[ ! -s "$RUNTIME_ENV" ]]; then
  echo "Falta $RUNTIME_ENV. Ejecuta primero: bash scripts/localstack-up.sh" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$RUNTIME_ENV"
set +a

aws_local() {
  docker compose -f "$COMPOSE_FILE" exec -T localstack awslocal "$@"
}

expected_tables=(
  app-finances-local-audit-log
  app-finances-local-invoice-pdf-metadata
  app-finances-local-user-memberships
)

for table in "${expected_tables[@]}"; do
  aws_local dynamodb describe-table --table-name "$table" >/dev/null
done

aws_local s3api head-bucket --bucket app-finances-local-invoice-pdfs >/dev/null

if [[ "${LOCALSTACK_ENABLE_COGNITO:-false}" == "true" ]]; then
  auth_json="$(aws_local cognito-idp initiate-auth \
    --client-id "$AUTH_COGNITO_USER_POOL_CLIENT_ID" \
    --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters "USERNAME=$LOCAL_COGNITO_EMAIL,PASSWORD=$LOCAL_COGNITO_PASSWORD")"

  if ! jq -e '.AuthenticationResult.IdToken | strings | length > 0' <<<"$auth_json" >/dev/null; then
    echo "Cognito no devolvió un ID token válido." >&2
    exit 1
  fi
fi

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_isready -U "${LOCAL_POSTGRES_USER:-app}" -d "${LOCAL_POSTGRES_DB:-app_finances}" >/dev/null

if [[ "${LOCALSTACK_ENABLE_COGNITO:-false}" == "true" ]]; then
  echo "OK: PostgreSQL, Cognito, las 3 tablas DynamoDB y el bucket S3 están disponibles."
else
  echo "OK: PostgreSQL, las 3 tablas DynamoDB y el bucket S3 están disponibles (Cognito desactivado)."
fi

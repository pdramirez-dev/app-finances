#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Uso:
  scripts/bootstrap-dev.sh \
    --domain-prefix <cognito-domain-prefix> \
    --admin-email <admin@email.com> \
    --admin-password '<PasswordFuerte123!>' \
    [--account-id <uuid>] \
    [--account-name "Mi empresa"] \
    [--region us-east-1] \
    [--auth-url http://localhost:3000] \
    [--auth-secret <secret>] \
    [--deploy-frontend] \
    [--skip-infra-install]

Qué hace:
  1) Bootstrap y deploy del stack backend dev (Cognito, AppSync, Dynamo, S3, Lambda).
  2) Crea la cuenta piloto y el usuario OWNER con membresía activa.
  3) Actualiza .env local con outputs del backend.
  4) Opcional: deploy del frontend dev en Amplify.
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: comando requerido no encontrado: $1" >&2
    exit 1
  fi
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
    return
  fi

  node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
}

upsert_env() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  local tmp_file
  tmp_file="$(mktemp)"

  if [[ -f "$env_file" ]]; then
    awk -v k="$key" -v v="$value" '
      BEGIN { found=0 }
      $0 ~ ("^" k "=") {
        print k "=\"" v "\""
        found=1
        next
      }
      { print }
      END {
        if (!found) print k "=\"" v "\""
      }
    ' "$env_file" >"$tmp_file"
  else
    printf '%s="%s"\n' "$key" "$value" >"$tmp_file"
  fi

  mv "$tmp_file" "$env_file"
}

read_env() {
  local env_file="$1"
  local key="$2"

  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  local raw
  raw="$(awk -F= -v k="$key" '$1 == k {print substr($0, index($0, "=") + 1)}' "$env_file" | tail -n 1)"

  raw="${raw%\"}"
  raw="${raw#\"}"
  printf '%s' "$raw"
}

DOMAIN_PREFIX=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
ACCOUNT_ID="${APP_ACCOUNT_ID:-}"
ACCOUNT_NAME="Cuenta piloto"
REGION="${AWS_REGION:-us-east-1}"
AUTH_URL="http://localhost:3000"
AUTH_SECRET=""
DEPLOY_FRONTEND="false"
SKIP_INFRA_INSTALL="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain-prefix)
      DOMAIN_PREFIX="${2:-}"
      shift 2
      ;;
    --admin-email)
      ADMIN_EMAIL="${2:-}"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD="${2:-}"
      shift 2
      ;;
    --account-id)
      ACCOUNT_ID="${2:-}"
      shift 2
      ;;
    --account-name)
      ACCOUNT_NAME="${2:-}"
      shift 2
      ;;
    --region)
      REGION="${2:-}"
      shift 2
      ;;
    --auth-url)
      AUTH_URL="${2:-}"
      shift 2
      ;;
    --auth-secret)
      AUTH_SECRET="${2:-}"
      shift 2
      ;;
    --deploy-frontend)
      DEPLOY_FRONTEND="true"
      shift
      ;;
    --skip-infra-install)
      SKIP_INFRA_INSTALL="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: parámetro desconocido: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$DOMAIN_PREFIX" || -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  echo "Error: faltan parámetros requeridos." >&2
  usage
  exit 1
fi

require_cmd aws
require_cmd npm
require_cmd npx
require_cmd node

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"
ENV_FILE="$REPO_ROOT/.env"
STACK_NAME="AppFinances-Backend-dev"

if [[ -z "$ACCOUNT_ID" ]]; then
  ACCOUNT_ID="$(read_env "$ENV_FILE" "APP_ACCOUNT_ID")"
fi
if [[ -z "$ACCOUNT_ID" ]]; then
  ACCOUNT_ID="$(node -e "console.log(require('node:crypto').randomUUID())")"
fi
if [[ ! "$ACCOUNT_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]]; then
  echo "Error: --account-id debe ser un UUID válido." >&2
  exit 1
fi

export AWS_REGION="$REGION"

if [[ -z "$AUTH_SECRET" ]]; then
  AUTH_SECRET="$(read_env "$ENV_FILE" "AUTH_SECRET")"
  if [[ -z "$AUTH_SECRET" ]]; then
    AUTH_SECRET="$(generate_secret)"
  fi
fi

echo "Validando credenciales AWS..."
aws sts get-caller-identity >/dev/null

if [[ "$SKIP_INFRA_INSTALL" != "true" ]]; then
  echo "Instalando dependencias de infra..."
  npm --prefix "$INFRA_DIR" install
fi

echo "Bootstrapping CDK..."
npm --prefix "$INFRA_DIR" run cdk:bootstrap

echo "Desplegando backend dev..."
(
  cd "$INFRA_DIR"
  npx cdk deploy "$STACK_NAME" \
    --require-approval never \
    -c stages=dev \
    -c devCognitoDomainPrefix="$DOMAIN_PREFIX"
)

if [[ "$DEPLOY_FRONTEND" == "true" ]]; then
  echo "Desplegando frontend dev..."
  (
    cd "$INFRA_DIR"
    npx cdk deploy "AppFinances-Frontend-dev" \
      --require-approval never \
      -c stages=dev \
      -c devCognitoDomainPrefix="$DOMAIN_PREFIX" \
      -c devAuthSecret="$AUTH_SECRET"
  )
fi

echo "Leyendo outputs de CloudFormation..."
USER_POOL_ID="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue | [0]" --output text)"
USER_POOL_CLIENT_ID="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolClientId'].OutputValue | [0]" --output text)"
APPSYNC_URL="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='AppSyncGraphqlUrl'].OutputValue | [0]" --output text)"
MEMBERSHIPS_TABLE="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='UserMembershipsTableName'].OutputValue | [0]" --output text)"
DB_CLUSTER_ARN="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='DomainDbClusterArn'].OutputValue | [0]" --output text)"
DB_SECRET_ARN="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='DomainDbSecretArn'].OutputValue | [0]" --output text)"

if [[ "$USER_POOL_ID" == "None" || "$USER_POOL_CLIENT_ID" == "None" || "$APPSYNC_URL" == "None" ]]; then
  echo "Error: no se pudieron resolver todos los outputs del stack $STACK_NAME." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$REPO_ROOT/.env.example" "$ENV_FILE"
fi

echo "Actualizando $ENV_FILE..."
upsert_env "$ENV_FILE" "AUTH_SECRET" "$AUTH_SECRET"
upsert_env "$ENV_FILE" "AUTH_URL" "$AUTH_URL"
upsert_env "$ENV_FILE" "AUTH_COGNITO_USER_POOL_ID" "$USER_POOL_ID"
upsert_env "$ENV_FILE" "AUTH_COGNITO_USER_POOL_CLIENT_ID" "$USER_POOL_CLIENT_ID"
upsert_env "$ENV_FILE" "AUTH_COGNITO_SECRET" ""
upsert_env "$ENV_FILE" "APPSYNC_GRAPHQL_URL" "$APPSYNC_URL"
upsert_env "$ENV_FILE" "APP_ACCOUNT_ID" "$ACCOUNT_ID"

echo "Creando/actualizando usuario admin en Cognito..."
if aws cognito-idp admin-get-user --user-pool-id "$USER_POOL_ID" --username "$ADMIN_EMAIL" --region "$REGION" >/dev/null 2>&1; then
  USER_ACCOUNT_ID="$(aws cognito-idp admin-get-user --user-pool-id "$USER_POOL_ID" --username "$ADMIN_EMAIL" --region "$REGION" --query "UserAttributes[?Name=='custom:accountId'].Value | [0]" --output text)"
  if [[ "$USER_ACCOUNT_ID" != "$ACCOUNT_ID" ]]; then
    echo "Error: el usuario existente pertenece a '$USER_ACCOUNT_ID', no a '$ACCOUNT_ID'." >&2
    echo "custom:accountId es inmutable; usa el account id existente o recrea el usuario." >&2
    exit 1
  fi
  echo "Usuario ya existe, actualizando password..."
else
  aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$ADMIN_EMAIL" \
    --user-attributes "Name=email,Value=$ADMIN_EMAIL" "Name=email_verified,Value=true" "Name=custom:accountId,Value=$ACCOUNT_ID" \
    --message-action SUPPRESS \
    --region "$REGION" >/dev/null
fi

aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "$ADMIN_EMAIL" \
  --password "$ADMIN_PASSWORD" \
  --permanent \
  --region "$REGION" >/dev/null

USER_ID="$(aws cognito-idp admin-get-user --user-pool-id "$USER_POOL_ID" --username "$ADMIN_EMAIL" --region "$REGION" --query "UserAttributes[?Name=='sub'].Value | [0]" --output text)"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo "Aplicando migraciones y creando cuenta piloto..."
DB_CLUSTER_ARN="$DB_CLUSTER_ARN" DB_SECRET_ARN="$DB_SECRET_ARN" npm --prefix "$INFRA_DIR" run db:migrate:aurora
aws rds-data execute-statement \
  --resource-arn "$DB_CLUSTER_ARN" \
  --secret-arn "$DB_SECRET_ARN" \
  --database app_finances \
  --region "$REGION" \
  --sql "INSERT INTO accounts (id, type, display_name) VALUES (CAST(:id AS uuid), 'COMPANY'::account_type, :name) ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()" \
  --parameters "[{\"name\":\"id\",\"value\":{\"stringValue\":\"$ACCOUNT_ID\"}},{\"name\":\"name\",\"value\":{\"stringValue\":\"$ACCOUNT_NAME\"}}]" >/dev/null

echo "Registrando membresía OWNER activa..."
aws dynamodb put-item \
  --table-name "$MEMBERSHIPS_TABLE" \
  --region "$REGION" \
  --item "{\"accountId\":{\"S\":\"$ACCOUNT_ID\"},\"userId\":{\"S\":\"$USER_ID\"},\"role\":{\"S\":\"OWNER\"},\"status\":{\"S\":\"ACTIVE\"},\"createdAt\":{\"S\":\"$NOW\"},\"updatedAt\":{\"S\":\"$NOW\"}}"

echo
echo "Bootstrap dev completado."
echo "Stack: $STACK_NAME"
echo "UserPoolId: $USER_POOL_ID"
echo "UserPoolClientId: $USER_POOL_CLIENT_ID"
echo "AppSyncGraphqlUrl: $APPSYNC_URL"
echo "AccountId: $ACCOUNT_ID"
echo
echo "Siguiente paso: npm run dev"

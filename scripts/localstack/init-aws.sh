#!/usr/bin/env sh
set -eu

REGION="${AWS_DEFAULT_REGION:-us-east-1}"
ACCOUNT_ID="${LOCAL_ACCOUNT_ID:-00000000-0000-4000-8000-000000000001}"
ADMIN_EMAIL="${LOCAL_COGNITO_EMAIL:-admin@app-finances.local}"
ADMIN_PASSWORD="${LOCAL_COGNITO_PASSWORD:-LocalPass123!}"
RUNTIME_ENV="/var/lib/localstack/app-finances.env"

ensure_table() {
  table_name="$1"
  shift

  if ! awslocal dynamodb describe-table --table-name "$table_name" >/dev/null 2>&1; then
    awslocal dynamodb create-table --table-name "$table_name" "$@" >/dev/null
    awslocal dynamodb wait table-exists --table-name "$table_name"
  fi
}

ensure_table \
  app-finances-local-invoice-pdf-metadata \
  --attribute-definitions \
    AttributeName=invoiceId,AttributeType=S \
    AttributeName=version,AttributeType=N \
    AttributeName=stage,AttributeType=S \
    AttributeName=generatedAt,AttributeType=S \
  --key-schema \
    AttributeName=invoiceId,KeyType=HASH \
    AttributeName=version,KeyType=RANGE \
  --global-secondary-indexes \
    'IndexName=byGeneratedAt,KeySchema=[{AttributeName=stage,KeyType=HASH},{AttributeName=generatedAt,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
  --billing-mode PAY_PER_REQUEST

ensure_table \
  app-finances-local-user-memberships \
  --attribute-definitions \
    AttributeName=accountId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=accountId,KeyType=HASH \
    AttributeName=userId,KeyType=RANGE \
  --global-secondary-indexes \
    'IndexName=byUserId,KeySchema=[{AttributeName=userId,KeyType=HASH},{AttributeName=accountId,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
  --billing-mode PAY_PER_REQUEST

ensure_table \
  app-finances-local-audit-log \
  --attribute-definitions \
    AttributeName=accountId,AttributeType=S \
    AttributeName=sk,AttributeType=S \
    AttributeName=entityKey,AttributeType=S \
  --key-schema \
    AttributeName=accountId,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes \
    'IndexName=byEntity,KeySchema=[{AttributeName=accountId,KeyType=HASH},{AttributeName=entityKey,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
  --billing-mode PAY_PER_REQUEST

awslocal dynamodb update-time-to-live \
  --table-name app-finances-local-audit-log \
  --time-to-live-specification Enabled=true,AttributeName=ttl >/dev/null 2>&1 || true

if ! awslocal s3api head-bucket --bucket app-finances-local-invoice-pdfs >/dev/null 2>&1; then
  awslocal s3api create-bucket --bucket app-finances-local-invoice-pdfs --region "$REGION" >/dev/null
fi

POOL_ID="local-cognito-disabled"
CLIENT_ID="local-cognito-disabled"
USER_ID="dev-user"

if [ "${LOCALSTACK_ENABLE_COGNITO:-false}" = "true" ]; then
  POOL_ID="$(awslocal cognito-idp list-user-pools \
    --max-results 60 \
    --query "UserPools[?Name=='app-finances-local-users'].Id | [0]" \
    --output text)"

  if [ -z "$POOL_ID" ] || [ "$POOL_ID" = "None" ]; then
    POOL_ID="$(awslocal cognito-idp create-user-pool \
      --pool-name app-finances-local-users \
      --username-attributes email \
      --auto-verified-attributes email \
      --schema 'Name=accountId,AttributeDataType=String,Mutable=false,Required=false' \
      --query UserPool.Id \
      --output text)"
  fi

  CLIENT_ID="$(awslocal cognito-idp list-user-pool-clients \
    --user-pool-id "$POOL_ID" \
    --max-results 60 \
    --query "UserPoolClients[?ClientName=='app-finances-local-web-client'].ClientId | [0]" \
    --output text)"

  if [ -z "$CLIENT_ID" ] || [ "$CLIENT_ID" = "None" ]; then
    CLIENT_ID="$(awslocal cognito-idp create-user-pool-client \
      --user-pool-id "$POOL_ID" \
      --client-name app-finances-local-web-client \
      --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
      --prevent-user-existence-errors ENABLED \
      --query UserPoolClient.ClientId \
      --output text)"
  fi

  if ! awslocal cognito-idp admin-get-user \
    --user-pool-id "$POOL_ID" \
    --username "$ADMIN_EMAIL" >/dev/null 2>&1; then
    awslocal cognito-idp admin-create-user \
      --user-pool-id "$POOL_ID" \
      --username "$ADMIN_EMAIL" \
      --message-action SUPPRESS \
      --user-attributes \
        Name=email,Value="$ADMIN_EMAIL" \
        Name=email_verified,Value=true \
        Name=custom:accountId,Value="$ACCOUNT_ID" >/dev/null
  fi

  awslocal cognito-idp admin-set-user-password \
    --user-pool-id "$POOL_ID" \
    --username "$ADMIN_EMAIL" \
    --password "$ADMIN_PASSWORD" \
    --permanent >/dev/null

  USER_ID="$(awslocal cognito-idp admin-get-user \
    --user-pool-id "$POOL_ID" \
    --username "$ADMIN_EMAIL" \
    --query "UserAttributes[?Name=='sub'].Value | [0]" \
    --output text)"
fi

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
awslocal dynamodb put-item \
  --table-name app-finances-local-user-memberships \
  --item "{\"accountId\":{\"S\":\"$ACCOUNT_ID\"},\"userId\":{\"S\":\"$USER_ID\"},\"role\":{\"S\":\"OWNER\"},\"status\":{\"S\":\"ACTIVE\"},\"createdAt\":{\"S\":\"$NOW\"},\"updatedAt\":{\"S\":\"$NOW\"}}" >/dev/null

cat >"$RUNTIME_ENV" <<EOF
# Generado por scripts/localstack/init-aws.sh. No versionar.
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=$REGION
AWS_ENDPOINT_URL=http://localhost:4566
DATABASE_URL=postgresql://${LOCAL_POSTGRES_USER:-app}:${LOCAL_POSTGRES_PASSWORD:-app}@localhost:${LOCAL_POSTGRES_PORT:-5432}/${LOCAL_POSTGRES_DB:-app_finances}
AUTH_COGNITO_ENDPOINT_URL=http://localhost:4566
AUTH_COGNITO_USER_POOL_ID=$POOL_ID
AUTH_COGNITO_USER_POOL_CLIENT_ID=$CLIENT_ID
AUTH_COGNITO_SECRET=
LOCAL_COGNITO_EMAIL=$ADMIN_EMAIL
LOCAL_COGNITO_PASSWORD=$ADMIN_PASSWORD
LOCALSTACK_ENABLE_COGNITO=${LOCALSTACK_ENABLE_COGNITO:-false}
DEV_AUTH_BYPASS=true
AUTH_SECRET=local-only-auth-secret-change-me
AUTH_URL=http://localhost:3000
APP_ACCOUNT_ID=$ACCOUNT_ID
INVOICE_PDF_METADATA_TABLE_NAME=app-finances-local-invoice-pdf-metadata
USER_MEMBERSHIPS_TABLE_NAME=app-finances-local-user-memberships
AUDIT_LOG_TABLE_NAME=app-finances-local-audit-log
INVOICE_PDFS_BUCKET_NAME=app-finances-local-invoice-pdfs
EOF

echo "App Finances local AWS resources are ready."

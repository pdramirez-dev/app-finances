#!/usr/bin/env bash
# Full backend on Floci (local AWS emulator): Cognito, AppSync (APPSYNC_JS),
# Aurora PostgreSQL via the Data API, Lambda, S3, DynamoDB, EventBridge.
# Usage: bash scripts/floci/up.sh   (needs Docker or Podman)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENGINE="${CONTAINER_ENGINE:-$(command -v podman || command -v docker)}"
NETWORK=floci-net
OUT="$ROOT/.floci"
mkdir -p "$OUT"

# Podman runs rootless: mount its user socket and skip SELinux relabeling.
if [[ "$(basename "$ENGINE")" == "podman" ]]; then
  SOCKET="/run/user/$("$ENGINE" machine ssh id -u 2>/dev/null | tr -d '\r' || id -u)/podman/podman.sock"
  SOCKET_ARGS=(--security-opt label=disable -v "$SOCKET:/var/run/docker.sock")
else
  SOCKET_ARGS=(-v /var/run/docker.sock:/var/run/docker.sock)
fi

"$ENGINE" rm -f floci >/dev/null 2>&1 || true
"$ENGINE" network exists "$NETWORK" 2>/dev/null || "$ENGINE" network create "$NETWORK" >/dev/null
"$ENGINE" run -d --name floci --network "$NETWORK" -p 127.0.0.1:4566:4566 "${SOCKET_ARGS[@]}" \
  -e FLOCI_HOSTNAME=floci \
  -e FLOCI_SERVICES_DOCKER_NETWORK="$NETWORK" \
  -e FLOCI_SERVICES_LAMBDA_DOCKER_HOST_OVERRIDE=floci \
  docker.io/floci/floci:latest >/dev/null
until curl -sf http://localhost:4566/_floci/health >/dev/null; do sleep 1; done
echo "floci ready on http://localhost:4566"

export AWS_ENDPOINT_URL=http://localhost:4566 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1 CDK_DEFAULT_ACCOUNT=000000000000 CDK_DEFAULT_REGION=us-east-1
unset AWS_PROFILE

cd "$ROOT/infra"
npm run --silent build:resolvers
npx cdk bootstrap aws://000000000000/us-east-1 -c stages=dev >/dev/null
npx cdk deploy AppNexo-Backend-dev -c stages=dev -c localEmulator=true \
  -c devInvoiceEmailFrom="Facturas <facturas@nexo.local>" -c devInvoiceEmailIdentity=nexo.local \
  --require-approval never --outputs-file "$OUT/outputs.json" >/dev/null
# Lookups against the fake 000000000000 account must not leak into real deploys.
rm -f "$ROOT/infra/cdk.context.json"
echo "backend stack deployed"

output() { python3 -c "import json,sys;print(json.load(open('$OUT/outputs.json'))['AppNexo-Backend-dev']['$1'])"; }
export DB_CLUSTER_ARN="$(output DomainDbClusterArn)" DB_SECRET_ARN="$(output DomainDbSecretArn)"
npm run --silent db:migrate:aurora

ACCOUNT_ID=11111111-1111-4111-8111-111111111111
EMAIL="${FLOCI_USER_EMAIL:-owner@floci-demo.example}"
PASSWORD="${FLOCI_USER_PASSWORD:-Floci-Pass-123!}"
POOL="$(output CognitoUserPoolId)"
aws rds-data execute-statement --resource-arn "$DB_CLUSTER_ARN" --secret-arn "$DB_SECRET_ARN" --database app_nexo \
  --sql "INSERT INTO accounts (id, type, display_name, email) VALUES ('$ACCOUNT_ID', 'COMPANY', 'Floci Demo LLC', 'billing@floci-demo.example') ON CONFLICT DO NOTHING" >/dev/null
aws cognito-idp admin-create-user --user-pool-id "$POOL" --username "$EMAIL" --message-action SUPPRESS \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true Name=custom:accountId,Value="$ACCOUNT_ID" >/dev/null
aws cognito-idp admin-set-user-password --user-pool-id "$POOL" --username "$EMAIL" --password "$PASSWORD" --permanent
NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
SUB="$(aws cognito-idp admin-get-user --user-pool-id "$POOL" --username "$EMAIL" --query 'UserAttributes[?Name==`sub`].Value' --output text)"
aws dynamodb put-item --table-name "$(output UserMembershipsTableName)" \
  --item "{\"accountId\":{\"S\":\"$ACCOUNT_ID\"},\"userId\":{\"S\":\"$SUB\"},\"role\":{\"S\":\"OWNER\"},\"status\":{\"S\":\"ACTIVE\"},\"createdAt\":{\"S\":\"$NOW\"},\"updatedAt\":{\"S\":\"$NOW\"}}"

# SES rejects unverified senders, as the real sandbox does.
aws sesv2 create-email-identity --email-identity nexo.local >/dev/null

cat > "$OUT/app.env" <<ENV
# Source before \`npm run dev\` to run the web app against Floci.
APPSYNC_GRAPHQL_URL=http://localhost:4566/v1/apis/$(output AppSyncApiId)/graphql
AUTH_COGNITO_ENDPOINT_URL=http://localhost:4566
AUTH_COGNITO_USER_POOL_ID=$POOL
AUTH_COGNITO_USER_POOL_CLIENT_ID=$(output CognitoUserPoolClientId)
APPSYNC_AUTH_HEADER_PREFIX="Bearer "
DEV_AUTH_BYPASS=false
ENV
echo "seeded $EMAIL / $PASSWORD (account $ACCOUNT_ID)"
echo "app env written to .floci/app.env"

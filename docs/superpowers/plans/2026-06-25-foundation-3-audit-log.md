# Foundation Plan 3 — Audit log (DynamoDB + pipeline resolvers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar trazabilidad append-only de las acciones sensibles (datos bancarios, borrado de cliente, cambio de status de invoice, perfil de cuenta) en una tabla DynamoDB, escrita de forma atómica junto a la mutación de Postgres mediante pipeline resolvers de AppSync.

**Architecture:** Una tabla DynamoDB `audit-log` (PK `accountId`, SK `timestamp#uid`, GSI `byEntity`, TTL). Cada mutación sensible se vuelve un pipeline resolver de dos funciones: función 1 ejecuta el SQL en Aurora (la función RDS del Plan 2), función 2 escribe la entrada de auditoría en DynamoDB usando el resultado y los claims. La lógica del item de auditoría se extrae a un builder puro y se unit-testea.

**Tech Stack:** TypeScript, AWS CDK, AppSync pipeline resolvers (`@aws-appsync/utils`, `.../dynamodb`), DynamoDB, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-25-multi-tenant-foundation-design.md`
**Depende de:** Plan 2 (funciones RDS de las mutaciones, builders, bundling, harness).

---

## File Structure

- `infra/graphql/resolvers/src/lib/audit.ts` — builder puro del item de auditoría.
- `infra/graphql/resolvers/src/lib/audit.test.ts` — unit tests del builder.
- `infra/graphql/resolvers/src/fn-audit-write.ts` — AppSync function (DynamoDB PutItem) compartida.
- `infra/graphql/resolvers/src/pipeline-*.ts` — código pipeline (request/response) por mutación sensible.
- `infra/lib/stacks/backend-stack.ts` — tabla `audit-log`, data source DynamoDB, `AppsyncFunction`s y pipeline `Resolver`s.
- `infra/test/backend-stack.test.ts` — assertion CDK de la tabla y GSI.

---

## Task 1: Tabla DynamoDB `audit-log` en CDK (TDD)

**Files:**
- Modify: `infra/lib/stacks/backend-stack.ts`
- Test: `infra/test/backend-stack.test.ts`

- [ ] **Step 1: Añadir el test que falla**

Agregar a `infra/test/backend-stack.test.ts`:
```ts
test("provisions the audit-log table with byEntity GSI and TTL", () => {
  const t = synth();
  t.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: Match.arrayWith([
      Match.objectLike({ AttributeName: "accountId", KeyType: "HASH" }),
      Match.objectLike({ AttributeName: "sk", KeyType: "RANGE" }),
    ]),
    TimeToLiveSpecification: Match.objectLike({ AttributeName: "ttl", Enabled: true }),
    GlobalSecondaryIndexes: Match.arrayWith([
      Match.objectLike({ IndexName: "byEntity" }),
    ]),
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd infra && npx vitest run test/backend-stack.test.ts`
Expected: FAIL — no existe la tabla con esas props.

- [ ] **Step 3: Crear la tabla en `backend-stack.ts`**

```ts
const auditLogTable = new dynamodb.Table(this, "AuditLogTable", {
  tableName: `app-finances-${props.stage}-audit-log`,
  partitionKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
  sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "ttl",
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
  deletionProtection: isProd,
  removalPolicy,
});

auditLogTable.addGlobalSecondaryIndex({
  indexName: "byEntity",
  partitionKey: { name: "accountId", type: dynamodb.AttributeType.STRING },
  sortKey: { name: "entityKey", type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

new cdk.CfnOutput(this, "AuditLogTableName", { value: auditLogTable.tableName });
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `cd infra && npx vitest run test/backend-stack.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add infra/lib/stacks/backend-stack.ts infra/test/backend-stack.test.ts
git commit -m "feat(infra): add append-only audit-log DynamoDB table"
```

---

## Task 2: Builder puro del item de auditoría (TDD)

**Files:**
- Create: `infra/graphql/resolvers/src/lib/audit.ts`
- Test: `infra/graphql/resolvers/src/lib/audit.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

`audit.test.ts`:
```ts
import { test, expect } from "vitest";
import { buildAuditItem } from "./audit";

const base = {
  accountId: "ACC_A", actor: "user@x.com", action: "DELETE", entityType: "CLIENT",
  entityId: "C1", data: { name: "X" }, now: "2026-06-25T10:00:00.000Z", uid: "abc123", ttlSeconds: 1900000000,
};

test("partition key is accountId and sort key is timestamp#uid", () => {
  const it = buildAuditItem(base);
  expect(it.accountId).toBe("ACC_A");
  expect(it.sk).toBe("2026-06-25T10:00:00.000Z#abc123");
});

test("entityKey enables byEntity GSI lookups", () => {
  expect(buildAuditItem(base).entityKey).toBe("CLIENT#C1");
});

test("carries actor, action, at, ttl and serialized data", () => {
  const it = buildAuditItem(base);
  expect(it.actor).toBe("user@x.com");
  expect(it.action).toBe("DELETE");
  expect(it.at).toBe("2026-06-25T10:00:00.000Z");
  expect(it.ttl).toBe(1900000000);
  expect(it.data).toBe(JSON.stringify({ name: "X" }));
});

test("missing data serializes to null", () => {
  expect(buildAuditItem({ ...base, data: undefined }).data).toBeNull();
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd infra && npx vitest run graphql/resolvers/src/lib/audit.test.ts`
Expected: FAIL — `buildAuditItem` no existe.

- [ ] **Step 3: Implementar `audit.ts`**

```ts
export type AuditInput = {
  accountId: string;
  actor: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE";
  entityType: "ACCOUNT" | "CLIENT" | "BANK_ACCOUNT" | "INVOICE";
  entityId: string;
  data?: unknown;
  now: string;
  uid: string;
  ttlSeconds: number;
};

export type AuditItem = {
  accountId: string;
  sk: string;
  entityKey: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  data: string | null;
  at: string;
  ttl: number;
};

export function buildAuditItem(i: AuditInput): AuditItem {
  return {
    accountId: i.accountId,
    sk: `${i.now}#${i.uid}`,
    entityKey: `${i.entityType}#${i.entityId}`,
    actor: i.actor,
    action: i.action,
    entityType: i.entityType,
    entityId: i.entityId,
    data: i.data === undefined || i.data === null ? null : JSON.stringify(i.data),
    at: i.now,
    ttl: i.ttlSeconds,
  };
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `cd infra && npx vitest run graphql/resolvers/src/lib/audit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add infra/graphql/resolvers/src/lib/audit.ts infra/graphql/resolvers/src/lib/audit.test.ts
git commit -m "feat(audit): add pure audit-log item builder with unit tests"
```

---

## Task 3: AppSync function de escritura de auditoría

**Files:**
- Create: `infra/graphql/resolvers/src/fn-audit-write.ts`

- [ ] **Step 1: Escribir la función**

```ts
import { util } from "@aws-appsync/utils";
import * as ddb from "@aws-appsync/utils/dynamodb";
import { buildAuditItem } from "./lib/audit";

const TWO_YEARS_SECONDS = 63072000;

export function request(ctx: any) {
  const accountId = ctx.identity.claims["custom:accountId"];
  const actor = ctx.identity.claims.email ?? ctx.identity.sub;
  const meta = ctx.stash.audit; // { action, entityType }
  // entityId/data del resultado de la función RDS previa, con fallback a los args.
  const row = Array.isArray(ctx.prev?.result) ? ctx.prev.result[0] : ctx.prev?.result;
  const entityId =
    row?.id ?? ctx.args.invoiceId ?? ctx.args.clientId ?? ctx.args.bankAccountId ?? ctx.args.input?.id ?? "unknown";

  const item = buildAuditItem({
    accountId,
    actor,
    action: meta.action,
    entityType: meta.entityType,
    entityId,
    data: row ?? ctx.args,
    now: util.time.nowISO8601(),
    uid: util.autoId(),
    ttlSeconds: util.time.nowEpochSeconds() + TWO_YEARS_SECONDS,
  });

  return ddb.put({ key: { accountId: item.accountId, sk: item.sk }, item });
}

export function response(ctx: any) {
  // No alterar el resultado de la mutación: devolver lo que produjo la función RDS previa.
  return ctx.prev.result;
}
```

- [ ] **Step 2: Bundlear y verificar salida**

Run: `cd infra && npm run build:resolvers && ls graphql/resolvers/dist/fn-audit-write.js`
Expected: el archivo existe y el builder quedó inlined.

- [ ] **Step 3: Commit**

```bash
git add infra/graphql/resolvers/src/fn-audit-write.ts
git commit -m "feat(audit): add shared AppSync function to write audit entries"
```

---

## Task 4: Pipelines de las 4 mutaciones sensibles

**Files:**
- Create: `infra/graphql/resolvers/src/pipeline-put-bank-account.ts`, `pipeline-delete-client.ts`, `pipeline-update-invoice-status.ts`, `pipeline-put-account.ts`
- Modify: `infra/lib/stacks/backend-stack.ts`

- [ ] **Step 1: Escribir el código pipeline (request/response) por mutación**

Cada archivo fija la metadata de auditoría en el stash y deja pasar el contexto:
```ts
// pipeline-update-invoice-status.ts
export function request(ctx: any) {
  ctx.stash.audit = { action: "STATUS_CHANGE", entityType: "INVOICE" };
  return {};
}
export function response(ctx: any) {
  return ctx.prev.result;
}
```
Análogamente:
- `pipeline-put-bank-account.ts` → `{ action: "UPDATE", entityType: "BANK_ACCOUNT" }`
- `pipeline-delete-client.ts` → `{ action: "DELETE", entityType: "CLIENT" }`
- `pipeline-put-account.ts` → `{ action: "UPDATE", entityType: "ACCOUNT" }`

- [ ] **Step 2: En CDK, crear las AppSync functions y los pipelines**

En `backend-stack.ts`:
```ts
const auditDs = graphqlApi.addDynamoDbDataSource("AuditLogDs", auditLogTable);

function rdsFn(id: string, file: string) {
  return new appsync.AppsyncFunction(this, id, {
    api: graphqlApi, dataSource: rdsDs, name: id,
    runtime: jsRuntime, code: resolverFromFile(`../dist/${file}`),
  });
}
const auditFn = new appsync.AppsyncFunction(this, "AuditWriteFn", {
  api: graphqlApi, dataSource: auditDs, name: "AuditWriteFn",
  runtime: jsRuntime, code: resolverFromFile("../dist/fn-audit-write.js"),
});

// Ejemplo: updateInvoiceStatus como pipeline [mutación RDS, auditoría]
graphqlApi.createResolver("MutationUpdateInvoiceStatusResolver", {
  typeName: "Mutation", fieldName: "updateInvoiceStatus", runtime: jsRuntime,
  code: resolverFromFile("../dist/pipeline-update-invoice-status.js"),
  pipelineConfig: [
    rdsFn.call(this, "UpdateInvoiceStatusRdsFn", "mutation-update-invoice-status.js"),
    auditFn,
  ],
});
```
Repetir para `putBankAccount`, `deleteClient`, `putAccount` con su función RDS del Plan 2 y su pipeline file. **Estos cuatro reemplazan** los resolvers RDS unit creados en el Plan 2 para esas mismas mutaciones.

> Nota: las funciones RDS reutilizan el mismo código de resolver del Plan 2 (`mutation-*.js`); aquí pasan de ser un resolver unit a ser la primera función del pipeline.

- [ ] **Step 3: Conceder permisos** — `auditLogTable.grantWriteData` queda implícito al crear el `addDynamoDbDataSource` (AppSync crea el rol). Verificar en synth.

- [ ] **Step 4: Bundlear y sintetizar**

Run: `cd infra && npm run build:resolvers && npx cdk synth AppFinances-Backend-dev > /dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add infra/graphql/resolvers/src infra/lib/stacks/backend-stack.ts
git commit -m "feat(audit): pipeline resolvers writing audit entries for sensitive mutations"
```

---

## Task 5: Verificación end-to-end (post-deploy, documentada)

**Files:** ninguno (procedimiento de verificación).

- [ ] **Step 1: Documentar la verificación manual** en el PR/notas de despliegue:
  1. `cdk deploy AppFinances-Backend-dev`.
  2. Como usuario de la cuenta A, ejecutar `updateInvoiceStatus` sobre un invoice propio.
  3. `aws dynamodb query` sobre `app-finances-dev-audit-log` con `accountId = <A>` → existe una entrada con `action=STATUS_CHANGE`, `entityType=INVOICE`, `actor=<email>`, `at` reciente.
  4. Repetir para `putBankAccount`, `deleteClient`, `putAccount`.

- [ ] **Step 2: Confirmar no-regresión de mutaciones**

Run: `cd infra && npx vitest run`
Expected: todos los tests (builders, audit, aislamiento, CDK) verdes.

- [ ] **Step 3: Commit (si hubo ajustes)**

```bash
git add -A && git commit -m "test(audit): full suite green after pipeline wiring"
```

---

## Self-Review (completado por el autor del plan)

- **Cobertura del spec:** tabla `audit-log` (PK/SK + GSI `byEntity` + TTL) ✓; pipeline RDS→DynamoDB ✓; 4 acciones sensibles (bank, delete client, invoice status, account) ✓; `actor`/`accountId` desde claims ✓; `data` como snapshot ✓.
- **Sin placeholders:** builder, función y pipelines con código concreto; los 4 pipelines difieren solo en la metadata `{action, entityType}`, mostrada explícitamente.
- **Consistencia de tipos:** `buildAuditItem(AuditInput): AuditItem` se usa igual en función y tests; `ctx.stash.audit = { action, entityType }` se fija en el pipeline y se lee en `fn-audit-write`.
- **Atomicidad:** la auditoría va en la misma operación GraphQL (pipeline); si la función RDS falla, el pipeline no llega a escribir auditoría.

## Riesgos / notas

- **`util.autoUlid()` vs `util.autoId()`:** se usa `util.autoId()` (UUID, garantizado) con prefijo ISO8601 para ordenar por tiempo; suficiente para la bitácora.
- **"before" del cambio:** el MVP audita el estado resultante (`after`) + acción. Capturar el valor previo requeriría una lectura extra; queda como mejora futura.
- **Pruebas e2e del PutItem** se hacen post-deploy (Task 5); el unit test cubre la forma del item.

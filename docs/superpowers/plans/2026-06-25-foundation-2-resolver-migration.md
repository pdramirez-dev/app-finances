# Foundation Plan 2 — Migración de resolvers a Postgres + aislamiento por tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar todos los resolvers de dominio de DynamoDB a Postgres (Aurora + Data API) derivando `accountId` del claim de Cognito (nunca del cliente), eliminando el `Scan` y la numeración con race conditions, y blindando el aislamiento por tenant con tests.

**Architecture:** Los resolvers AppSync (JS) pasan a un data source RDS. La lógica SQL se extrae a builders puros (`infra/graphql/resolvers/src/lib/*.ts`) sin dependencias del runtime AppSync, para poder unit-testear la propiedad de aislamiento; los resolvers se bundlean con esbuild importando esos builders. Tests de integración contra Postgres local prueban que una cuenta no puede leer/escribir datos de otra.

**Tech Stack:** TypeScript, AWS CDK, AppSync JS resolvers (`@aws-appsync/utils/rds`), Aurora PostgreSQL + Data API, `@aws-sdk/client-rds-data`, esbuild, Vitest, node-postgres (`pg`).

**Spec:** `docs/superpowers/specs/2026-06-25-multi-tenant-foundation-design.md`
**Depende de:** Plan 1 (esquema, Aurora + Data API, `custom:accountId`, harness Vitest).

---

## File Structure

- `infra/graphql/resolvers/src/lib/sql-builders.ts` — funciones puras `{statement, params}` por operación (fuente de verdad del SQL + scoping por `account_id`).
- `infra/graphql/resolvers/src/lib/sql-builders.test.ts` — unit tests de aislamiento (el `accountId` sale del claim, nunca de args).
- `infra/graphql/resolvers/src/*.ts` — resolvers AppSync (request/response) que importan los builders.
- `infra/graphql/resolvers/build.mjs` — bundling esbuild de `src/*.ts` → `dist/*.js`.
- `infra/test/isolation.int.test.ts` — integración contra Postgres local: cross-tenant denegado.
- `infra/scripts/apply-migrations-aurora.ts` — aplica el esquema a Aurora vía Data API.
- `infra/lib/stacks/backend-stack.ts` — añadir `RdsDataSource`, conmutar resolvers, retirar Dynamo de dominio.
- `infra/graphql/schema.graphql` — quitar args/inputs `accountId`.
- `src/lib/appsync/invoices.ts` — quitar `accountId` de queries, eliminar `getNextInvoiceNumber`.

---

## Task 1: Bundling de resolvers (esbuild) + estructura de fuentes

**Files:**
- Create: `infra/graphql/resolvers/build.mjs`
- Create: `infra/graphql/resolvers/src/lib/sql-builders.ts` (stub temporal)
- Create: `infra/graphql/resolvers/src/ping.ts` (resolver de humo)
- Modify: `infra/package.json`

- [ ] **Step 1: Instalar esbuild en infra**

Run: `cd infra && npm install -D esbuild`
Expected: esbuild en `infra/package.json` devDeps.

- [ ] **Step 2: Crear builder stub `src/lib/sql-builders.ts`**

```ts
export type SqlRequest = { statement: string; params: Record<string, unknown> };
```

- [ ] **Step 3: Crear resolver de humo `src/ping.ts`**

```ts
import { sqlPing } from "./lib/sql-builders";
export function request() {
  return { ping: sqlPing() };
}
export function response(ctx: any) {
  return ctx;
}
```
Y añadir a `sql-builders.ts`: `export function sqlPing() { return "ok"; }`

- [ ] **Step 4: Crear `build.mjs`**

```js
import { build } from "esbuild";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const srcDir = "graphql/resolvers/src";
const outDir = "graphql/resolvers/dist";
const entries = readdirSync(srcDir).filter((f) => f.endsWith(".ts"));

await build({
  entryPoints: entries.map((f) => join(srcDir, f)),
  outdir: outDir,
  bundle: true,
  format: "esm",
  target: "es2020",
  sourcemap: false,
  external: ["@aws-appsync/utils", "@aws-appsync/utils/rds"],
});
console.log(`bundled ${entries.length} resolvers → ${outDir}`);
```

- [ ] **Step 5: Añadir script y correr**

En `infra/package.json` scripts: `"build:resolvers": "node graphql/resolvers/build.mjs"`
Run: `cd infra && npm run build:resolvers && ls graphql/resolvers/dist/ping.js`
Expected: `dist/ping.js` existe y NO contiene `import "./lib` (el builder quedó inlined).

- [ ] **Step 6: Ignorar dist en git**

Añadir `infra/graphql/resolvers/dist` a `.gitignore`.

- [ ] **Step 7: Commit**

```bash
git add infra/package.json infra/package-lock.json infra/graphql/resolvers/build.mjs infra/graphql/resolvers/src .gitignore
git commit -m "build(infra): bundle AppSync resolvers with esbuild and shared SQL builders"
```

---

## Task 2: SQL builders con aislamiento por tenant (TDD)

**Files:**
- Modify: `infra/graphql/resolvers/src/lib/sql-builders.ts`
- Test: `infra/graphql/resolvers/src/lib/sql-builders.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

`sql-builders.test.ts`:
```ts
import { test, expect } from "vitest";
import {
  listInvoices, getInvoice, getInvoiceByNumber, deleteInvoice,
  listClients, getClient, deleteClient, getBankAccount, getAccount,
} from "./sql-builders";

test("listInvoices scopes by claim accountId and ignores args.accountId", () => {
  const r = listInvoices("ACC_A", { accountId: "ACC_B", limit: 10 } as any);
  expect(r.statement).toMatch(/account_id\s*=\s*:acc/i);
  expect(r.statement).not.toMatch(/\bScan\b/);
  expect(r.params.acc).toBe("ACC_A");
});

test("getInvoice requires both id and account scope", () => {
  const r = getInvoice("ACC_A", { invoiceId: "INV1" } as any);
  expect(r.statement).toMatch(/id\s*=\s*:id/i);
  expect(r.statement).toMatch(/account_id\s*=\s*:acc/i);
  expect(r.params).toMatchObject({ id: "INV1", acc: "ACC_A" });
});

test("getInvoiceByNumber is scoped per account", () => {
  const r = getInvoiceByNumber("ACC_A", { invoiceNumber: 7 } as any);
  expect(r.statement).toMatch(/invoice_number\s*=\s*:num/i);
  expect(r.statement).toMatch(/account_id\s*=\s*:acc/i);
  expect(r.params).toMatchObject({ num: 7, acc: "ACC_A" });
});

test("deleteInvoice/deleteClient are scoped by account", () => {
  expect(deleteInvoice("ACC_A", { invoiceId: "X" } as any).statement)
    .toMatch(/DELETE FROM invoices WHERE id = :id AND account_id = :acc/i);
  expect(deleteClient("ACC_A", { clientId: "C" } as any).statement)
    .toMatch(/DELETE FROM clients WHERE id = :id AND account_id = :acc/i);
});

test("list/get builders for clients, bank, account scope by account", () => {
  expect(listClients("ACC_A", { accountId: "ACC_B" } as any).params.acc).toBe("ACC_A");
  expect(getClient("ACC_A", { clientId: "C" } as any).statement).toMatch(/account_id = :acc/i);
  expect(getBankAccount("ACC_A", { bankAccountId: "B" } as any).statement).toMatch(/account_id = :acc/i);
  expect(getAccount("ACC_A").statement).toMatch(/id = :acc/i);
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd infra && npx vitest run graphql/resolvers/src/lib/sql-builders.test.ts`
Expected: FAIL — los builders no existen.

- [ ] **Step 3: Implementar los builders**

`sql-builders.ts` (reemplaza el stub, conserva `SqlRequest`):
```ts
export type SqlRequest = { statement: string; params: Record<string, unknown> };

const INVOICE_COLS =
  "id, account_id, client_id, invoice_number, date, week_number, bill_to_name, bill_to_address, project, currency, notes, grand_total, status, created_at, updated_at";

export function listInvoices(acc: string, args: { status?: string; limit?: number }): SqlRequest {
  const where = args.status ? "account_id = :acc AND status = :status" : "account_id = :acc";
  const params: Record<string, unknown> = { acc, lim: args.limit ?? 25 };
  if (args.status) params.status = args.status;
  return {
    statement: `SELECT ${INVOICE_COLS} FROM invoices WHERE ${where} ORDER BY created_at DESC LIMIT :lim`,
    params,
  };
}

export function getInvoice(acc: string, args: { invoiceId: string }): SqlRequest {
  return {
    statement: `SELECT ${INVOICE_COLS} FROM invoices WHERE id = :id AND account_id = :acc`,
    params: { id: args.invoiceId, acc },
  };
}

export function getInvoiceByNumber(acc: string, args: { invoiceNumber: number }): SqlRequest {
  return {
    statement: `SELECT ${INVOICE_COLS} FROM invoices WHERE invoice_number = :num AND account_id = :acc`,
    params: { num: args.invoiceNumber, acc },
  };
}

export function deleteInvoice(acc: string, args: { invoiceId: string }): SqlRequest {
  return {
    statement: "DELETE FROM invoices WHERE id = :id AND account_id = :acc",
    params: { id: args.invoiceId, acc },
  };
}

export function updateInvoiceStatus(acc: string, args: { invoiceId: string; status: string }): SqlRequest {
  return {
    statement: `UPDATE invoices SET status = :status, updated_at = now()
                WHERE id = :id AND account_id = :acc RETURNING ${INVOICE_COLS}`,
    params: { id: args.invoiceId, status: args.status, acc },
  };
}

export function listClients(acc: string, _args: { limit?: number }): SqlRequest {
  return {
    statement: "SELECT * FROM clients WHERE account_id = :acc ORDER BY lower(name) LIMIT :lim",
    params: { acc, lim: _args.limit ?? 25 },
  };
}

export function getClient(acc: string, args: { clientId: string }): SqlRequest {
  return {
    statement: "SELECT * FROM clients WHERE id = :id AND account_id = :acc",
    params: { id: args.clientId, acc },
  };
}

export function deleteClient(acc: string, args: { clientId: string }): SqlRequest {
  return {
    statement: "DELETE FROM clients WHERE id = :id AND account_id = :acc",
    params: { id: args.clientId, acc },
  };
}

export function getBankAccount(acc: string, args: { bankAccountId: string }): SqlRequest {
  return {
    statement: "SELECT * FROM bank_accounts WHERE id = :id AND account_id = :acc",
    params: { id: args.bankAccountId, acc },
  };
}

export function getAccount(acc: string): SqlRequest {
  return { statement: "SELECT * FROM accounts WHERE id = :acc", params: { acc } };
}
```
(Eliminar el `sqlPing` stub y `src/ping.ts` ya no es necesario; bórralo.)

- [ ] **Step 4: Correr para verificar que pasa**

Run: `cd infra && npx vitest run graphql/resolvers/src/lib/sql-builders.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add infra/graphql/resolvers/src/lib
git rm infra/graphql/resolvers/src/ping.ts
git commit -m "feat(resolvers): add tenant-scoped SQL builders with isolation unit tests"
```

---

## Task 3: Aplicar el esquema a Aurora vía Data API

**Files:**
- Create: `infra/scripts/apply-migrations-aurora.ts`
- Modify: `infra/package.json`

- [ ] **Step 1: Instalar el cliente Data API**

Run: `cd infra && npm install @aws-sdk/client-rds-data`

- [ ] **Step 2: Crear el script**

`infra/scripts/apply-migrations-aurora.ts`:
```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RDSDataClient, ExecuteStatementCommand } from "@aws-sdk/client-rds-data";

const { DB_CLUSTER_ARN, DB_SECRET_ARN, DB_NAME = "app_finances" } = process.env;
if (!DB_CLUSTER_ARN || !DB_SECRET_ARN) throw new Error("DB_CLUSTER_ARN and DB_SECRET_ARN are required");

const client = new RDSDataClient({});
const dir = join(__dirname, "..", "..", "db", "migrations");

async function exec(sql: string) {
  await client.send(new ExecuteStatementCommand({
    resourceArn: DB_CLUSTER_ARN, secretArn: DB_SECRET_ARN, database: DB_NAME, sql,
  }));
}

async function main() {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    for (const stmt of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
      await exec(stmt);
    }
    console.log(`applied ${f}`);
  }
}

main().then(() => console.log("done"));
```

- [ ] **Step 3: Añadir script en package.json**

`"db:migrate:aurora": "tsx scripts/apply-migrations-aurora.ts"`

- [ ] **Step 4: Verificar que compila/typecheck**

Run: `cd infra && npx tsc --noEmit`
Expected: sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add infra/scripts infra/package.json infra/package-lock.json
git commit -m "feat(infra): apply Postgres schema to Aurora via Data API"
```

> Nota de despliegue: se ejecuta una vez tras `cdk deploy`, con `DB_CLUSTER_ARN`/`DB_SECRET_ARN` de los outputs del Plan 1.

---

## Task 4: Data source RDS en AppSync + resolvers de lectura (clients como template)

**Files:**
- Create: `infra/graphql/resolvers/src/query-list-clients.ts`, `query-get-client.ts`
- Modify: `infra/lib/stacks/backend-stack.ts`

- [ ] **Step 1: Escribir los resolvers**

`src/query-list-clients.ts`:
```ts
import { util } from "@aws-appsync/utils";
import { sql, createPgStatement, toJsonObject } from "@aws-appsync/utils/rds";
import { listClients } from "./lib/sql-builders";

export function request(ctx: any) {
  const acc = ctx.identity.claims["custom:accountId"];
  if (!acc) util.unauthorized();
  const { statement, params } = listClients(acc, ctx.args);
  return createPgStatement(sql([statement] as any, params));
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const rows = toJsonObject(ctx.result)[0] ?? [];
  return { items: rows, nextToken: null };
}
```

> Implementación: el helper `sql` de AppSync espera parámetros nombrados `:name`. Si la firma exacta difiere en la versión instalada, envolver `statement`/`params` con la utilidad equivalente (`createPgStatement` admite `{ statement, parameters }`). El builder ya entrega `:acc`, `:lim`, etc.

`src/query-get-client.ts`: idéntico patrón usando `getClient(acc, ctx.args)` y `response` que devuelve `toJsonObject(ctx.result)[0]?.[0] ?? null`.

- [ ] **Step 2: Añadir el RDS data source y conmutar estos dos resolvers en CDK**

En `backend-stack.ts`, tras crear `dbCluster` (Plan 1):
```ts
const rdsDs = graphqlApi.addRdsDataSource("DomainRdsDs", dbCluster, dbCluster.secret!);
```
Y reemplazar la creación de `QueryListClientsResolver` y `QueryGetClientResolver` para usar `rdsDs` + `resolverFromFile("../dist/query-list-clients.js")` (apuntando al output bundleado).

- [ ] **Step 3: Bundlear y sintetizar**

Run: `cd infra && npm run build:resolvers && npx cdk synth AppFinances-Backend-dev > /dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add infra/graphql/resolvers/src infra/lib/stacks/backend-stack.ts
git commit -m "feat(resolvers): migrate clients read resolvers to Aurora RDS data source"
```

---

## Task 5: Test de aislamiento cross-tenant (integración, TDD)

**Files:**
- Test: `infra/test/isolation.int.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Verifica la propiedad de seguridad directamente contra Postgres local, usando los builders como fuente de verdad del SQL:
```ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { Client } from "pg";
import { runMigrations } from "../../db/migrate";
import { listClients, getClient, getInvoice } from "../graphql/resolvers/src/lib/sql-builders";

const URL = process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:55432/app_finances_test";
let db: Client;

// Ejecuta un SqlRequest (:name) sustituyendo por placeholders posicionales de pg.
async function run(req: { statement: string; params: Record<string, unknown> }) {
  const names = Object.keys(req.params);
  let i = 0;
  const text = req.statement.replace(/:([a-zA-Z_]+)/g, (_, n) => `$${names.indexOf(n) + 1}`);
  const values = names.map((n) => req.params[n]);
  const { rows } = await db.query(text, values);
  return rows;
}

beforeAll(async () => {
  await runMigrations(URL);
  db = new Client({ connectionString: URL });
  await db.connect();
  await db.query("DELETE FROM invoice_line_items; DELETE FROM invoice_sections; DELETE FROM invoices; DELETE FROM clients; DELETE FROM accounts;");
  await db.query("INSERT INTO accounts (id, type, display_name) VALUES ('11111111-1111-1111-1111-111111111111','COMPANY','A'),('22222222-2222-2222-2222-222222222222','COMPANY','B')");
  await db.query("INSERT INTO clients (id, account_id, name) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cliente A'),('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Cliente B')");
});

afterAll(async () => { await db?.end(); });

const ACC_A = "11111111-1111-1111-1111-111111111111";
const ACC_B = "22222222-2222-2222-2222-222222222222";

test("listClients only returns the caller account's clients", async () => {
  const rows = await run(listClients(ACC_A, {}));
  expect(rows).toHaveLength(1);
  expect(rows[0].name).toBe("Cliente A");
});

test("account A cannot read account B's client by id", async () => {
  const rows = await run(getClient(ACC_A, { clientId: "bbbbbbbb-0000-0000-0000-000000000001" }));
  expect(rows).toHaveLength(0);
});

test("account A cannot read a nonexistent/other invoice", async () => {
  const rows = await run(getInvoice(ACC_A, { invoiceId: "00000000-0000-0000-0000-000000000000" }));
  expect(rows).toHaveLength(0);
});
```

- [ ] **Step 2: Correr y verificar que pasa**

Run: `docker compose -f docker-compose.test.yml up -d && cd infra && npx vitest run test/isolation.int.test.ts`
Expected: PASS (3 tests). (El test es verde porque los builders ya scopean por `account_id`; sirve de red de regresión.)

- [ ] **Step 3: Commit**

```bash
git add infra/test/isolation.int.test.ts
git commit -m "test(security): cross-tenant isolation integration tests"
```

---

## Task 6: Resolvers de accounts y bank_accounts (lectura + escritura)

**Files:**
- Create: `infra/graphql/resolvers/src/query-get-account.ts`, `query-get-bank-account.ts`, `mutation-put-account.ts`, `mutation-put-client.ts`, `mutation-put-bank-account.ts`, `mutation-delete-client.ts`
- Modify: `backend-stack.ts`

- [ ] **Step 1: Añadir builders de escritura (TDD)**

Añadir tests a `sql-builders.test.ts`:
```ts
test("putClient injects account_id from claim, not from input", async () => {
  const { putClient } = await import("./sql-builders");
  const r = putClient("ACC_A", { input: { accountId: "ACC_B", name: "X" } } as any);
  expect(r.statement).toMatch(/INSERT INTO clients/i);
  expect(r.params.acc).toBe("ACC_A");
});
```
Run: `cd infra && npx vitest run graphql/resolvers/src/lib/sql-builders.test.ts` → FAIL.

- [ ] **Step 2: Implementar los builders de escritura**

Añadir a `sql-builders.ts`:
```ts
export function putClient(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `INSERT INTO clients (id, account_id, name, email, phone, address, tax_id, updated_at)
                VALUES (COALESCE(:id, gen_random_uuid()), :acc, :name, :email, :phone, :address, :taxId, now())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
                  phone = EXCLUDED.phone, address = EXCLUDED.address, tax_id = EXCLUDED.tax_id, updated_at = now()
                WHERE clients.account_id = :acc
                RETURNING *`,
    params: { id: i.clientId ?? null, acc, name: i.name, email: i.email ?? null,
              phone: i.phone ?? null, address: i.address ?? null, taxId: i.taxId ?? null },
  };
}

export function putBankAccount(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `INSERT INTO bank_accounts (id, account_id, beneficiary_name, bank_name,
                  account_number_masked, routing_number_masked, iban_masked, swift_code, currency, country, updated_at)
                VALUES (COALESCE(:id, gen_random_uuid()), :acc, :ben, :bank, :acct, :rout, :iban, :swift, :cur, :country, now())
                ON CONFLICT (id) DO UPDATE SET beneficiary_name = EXCLUDED.beneficiary_name, bank_name = EXCLUDED.bank_name,
                  account_number_masked = EXCLUDED.account_number_masked, routing_number_masked = EXCLUDED.routing_number_masked,
                  iban_masked = EXCLUDED.iban_masked, swift_code = EXCLUDED.swift_code, currency = EXCLUDED.currency,
                  country = EXCLUDED.country, updated_at = now()
                WHERE bank_accounts.account_id = :acc
                RETURNING *`,
    params: { id: i.bankAccountId ?? null, acc, ben: i.beneficiaryName, bank: i.bankName,
              acct: i.accountNumberMasked ?? null, rout: i.routingNumberMasked ?? null, iban: i.ibanMasked ?? null,
              swift: i.swiftCode ?? null, cur: i.currency, country: i.country ?? null },
  };
}

export function putAccount(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `INSERT INTO accounts (id, type, display_name, legal_name, tax_id, email, phone, address, updated_at)
                VALUES (:acc, :type, :displayName, :legalName, :taxId, :email, :phone, :address, now())
                ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, display_name = EXCLUDED.display_name,
                  legal_name = EXCLUDED.legal_name, tax_id = EXCLUDED.tax_id, email = EXCLUDED.email,
                  phone = EXCLUDED.phone, address = EXCLUDED.address, updated_at = now()
                RETURNING *`,
    params: { acc, type: i.type, displayName: i.displayName, legalName: i.legalName ?? null,
              taxId: i.taxId ?? null, email: i.email ?? null, phone: i.phone ?? null, address: i.address ?? null },
  };
}
```
Run el test → PASS.

- [ ] **Step 3: Escribir los resolvers** (patrón de Task 4) para `getAccount`, `getBankAccount`, `putAccount`, `putClient`, `putBankAccount`, `deleteClient`, importando el builder correspondiente. `response` de mutaciones devuelve `toJsonObject(ctx.result)[0]?.[0] ?? null`; `deleteClient` devuelve `true`.

- [ ] **Step 4: Conmutar estos resolvers a `rdsDs` en CDK** (reemplazar las creaciones DynamoDB correspondientes por `rdsDs` + `dist/*.js`).

- [ ] **Step 5: Bundlear, typecheck, synth**

Run: `cd infra && npm run build:resolvers && npx tsc --noEmit && npx cdk synth AppFinances-Backend-dev > /dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add infra/graphql/resolvers/src infra/lib/stacks/backend-stack.ts
git commit -m "feat(resolvers): migrate accounts, clients and bank-account resolvers to Postgres"
```

---

## Task 7: Invoices — numeración atómica, cascada, secciones y líneas

**Files:**
- Create: `infra/graphql/resolvers/src/query-list-invoices.ts`, `query-get-invoice.ts`, `query-get-invoice-by-number.ts`, `mutation-put-invoice.ts`, `mutation-update-invoice-status.ts`, `mutation-delete-invoice.ts`, y los de sections/line-items + field resolvers.
- Modify: `sql-builders.ts` (+ test), `backend-stack.ts`

- [ ] **Step 1: Test del builder de creación con numeración atómica (TDD)**

Añadir a `sql-builders.test.ts`:
```ts
test("putInvoice (create) bumps the per-account counter and inserts atomically", async () => {
  const { putInvoiceCreate } = await import("./sql-builders");
  const r = putInvoiceCreate("ACC_A", { input: { invoiceNumber: 0, date: "2026-01-01", weekNumber: 1,
    billToName: "x", billToAddress: "y", project: "p", grandTotal: 10 } } as any);
  expect(r.statement).toMatch(/UPDATE invoice_counters/i);
  expect(r.statement).toMatch(/INSERT INTO invoices/i);
  expect(r.params.acc).toBe("ACC_A");
});
```
Run → FAIL.

- [ ] **Step 2: Implementar builders de invoices**

Añadir a `sql-builders.ts`:
```ts
export function putInvoiceCreate(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `WITH n AS (
        INSERT INTO invoice_counters (account_id, last_invoice_number) VALUES (:acc, 1)
        ON CONFLICT (account_id) DO UPDATE SET last_invoice_number = invoice_counters.last_invoice_number + 1
        RETURNING last_invoice_number)
      INSERT INTO invoices (account_id, client_id, invoice_number, date, week_number, bill_to_name,
        bill_to_address, project, currency, notes, grand_total, status)
      SELECT :acc, :clientId, n.last_invoice_number, :date, :week, :billName, :billAddr, :project,
        :currency, :notes, :grandTotal, :status FROM n
      RETURNING *`,
    params: { acc, clientId: i.clientId ?? null, date: i.date, week: i.weekNumber, billName: i.billToName,
      billAddr: i.billToAddress, project: i.project, currency: i.currency ?? "USD", notes: i.notes ?? null,
      grandTotal: i.grandTotal, status: i.status ?? "DRAFT" },
  };
}

export function putInvoiceSection(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `INSERT INTO invoice_sections (id, invoice_id, title, position, total)
      SELECT COALESCE(:id, gen_random_uuid()), inv.id, :title, :position, :total
        FROM invoices inv WHERE inv.id = :invoiceId AND inv.account_id = :acc
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position, total = EXCLUDED.total
      RETURNING *`,
    params: { id: i.sectionId ?? null, invoiceId: i.invoiceId, acc, title: i.title, position: i.position, total: i.total },
  };
}

export function deleteInvoiceSection(acc: string, args: { invoiceId: string; sectionId: string }): SqlRequest {
  return {
    statement: `DELETE FROM invoice_sections s USING invoices inv
      WHERE s.id = :sectionId AND s.invoice_id = inv.id AND inv.id = :invoiceId AND inv.account_id = :acc`,
    params: { sectionId: args.sectionId, invoiceId: args.invoiceId, acc },
  };
}

export function putInvoiceLineItem(acc: string, args: { input: any }): SqlRequest {
  const i = args.input;
  return {
    statement: `INSERT INTO invoice_line_items (id, section_id, description, quantity, amount, position)
      SELECT COALESCE(:id, gen_random_uuid()), s.id, :description, :quantity, :amount, :position
        FROM invoice_sections s JOIN invoices inv ON inv.id = s.invoice_id
        WHERE s.id = :sectionId AND inv.account_id = :acc
      ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, quantity = EXCLUDED.quantity,
        amount = EXCLUDED.amount, position = EXCLUDED.position
      RETURNING *`,
    params: { id: i.lineItemId ?? null, sectionId: i.sectionId, acc, description: i.description,
      quantity: i.quantity, amount: i.amount, position: i.position },
  };
}

export function deleteInvoiceLineItem(acc: string, args: { sectionId: string; lineItemId: string }): SqlRequest {
  return {
    statement: `DELETE FROM invoice_line_items li USING invoice_sections s JOIN invoices inv ON inv.id = s.invoice_id
      WHERE li.id = :lineItemId AND li.section_id = s.id AND s.id = :sectionId AND inv.account_id = :acc`,
    params: { lineItemId: args.lineItemId, sectionId: args.sectionId, acc },
  };
}

export function sectionsByInvoice(acc: string, source: { id: string }): SqlRequest {
  return {
    statement: `SELECT s.* FROM invoice_sections s JOIN invoices inv ON inv.id = s.invoice_id
      WHERE s.invoice_id = :invoiceId AND inv.account_id = :acc ORDER BY s.position`,
    params: { invoiceId: source.id, acc },
  };
}

export function lineItemsBySection(acc: string, source: { sectionId: string }): SqlRequest {
  return {
    statement: `SELECT li.* FROM invoice_line_items li JOIN invoice_sections s ON s.id = li.section_id
      JOIN invoices inv ON inv.id = s.invoice_id
      WHERE li.section_id = :sectionId AND inv.account_id = :acc ORDER BY li.position`,
    params: { sectionId: source.sectionId, acc },
  };
}
```
Run el test → PASS.

- [ ] **Step 3: Test de integración — numeración e isolation de secciones**

Añadir a `infra/test/isolation.int.test.ts`:
```ts
test("putInvoiceCreate yields sequential per-account numbers starting at 1", async () => {
  const { putInvoiceCreate } = await import("../graphql/resolvers/src/lib/sql-builders");
  const mk = () => ({ input: { date: "2026-01-01", weekNumber: 1, billToName: "a",
    billToAddress: "b", project: "p", grandTotal: 1 } });
  const r1 = await run(putInvoiceCreate(ACC_A, mk() as any));
  const r2 = await run(putInvoiceCreate(ACC_A, mk() as any));
  const r3 = await run(putInvoiceCreate(ACC_B, mk() as any));
  expect(r1[0].invoice_number).toBe(1);
  expect(r2[0].invoice_number).toBe(2);
  expect(r3[0].invoice_number).toBe(1); // cuenta B numera independiente
});

test("deleteInvoiceSection cannot touch another account's section", async () => {
  const { putInvoiceCreate, putInvoiceSection, deleteInvoiceSection } =
    await import("../graphql/resolvers/src/lib/sql-builders");
  const inv = (await run(putInvoiceCreate(ACC_A, { input: { date: "2026-01-01", weekNumber: 1,
    billToName: "a", billToAddress: "b", project: "p", grandTotal: 1 } } as any)))[0];
  const sec = (await run(putInvoiceSection(ACC_A, { input: { invoiceId: inv.id, title: "T", position: 0, total: 0 } } as any)))[0];
  const deletedByB = await run(deleteInvoiceSection(ACC_B, { invoiceId: inv.id, sectionId: sec.id }));
  expect(deletedByB).toHaveLength(0); // B no borra nada
});
```
Run: `cd infra && npx vitest run test/isolation.int.test.ts` → PASS.

- [ ] **Step 4: Escribir los resolvers de invoices/sections/line-items + field resolvers**

Patrón de Task 4. Field resolvers `Invoice.sections` y `InvoiceSection.lineItems` usan `sectionsByInvoice(acc, ctx.source)` y `lineItemsBySection(acc, ctx.source)`. `listInvoices.response` devuelve `{ items: rows, nextToken: null }`.

- [ ] **Step 5: Conmutar todos los resolvers de invoices a `rdsDs` en CDK** y retirar sus data sources DynamoDB.

- [ ] **Step 6: Bundlear, typecheck, synth, test**

Run: `cd infra && npm run build:resolvers && npx tsc --noEmit && npx vitest run && npx cdk synth AppFinances-Backend-dev > /dev/null && echo OK`
Expected: `OK` y todos los tests verdes.

- [ ] **Step 7: Commit**

```bash
git add infra/graphql/resolvers/src infra/test/isolation.int.test.ts infra/lib/stacks/backend-stack.ts
git commit -m "feat(resolvers): migrate invoices with atomic numbering, cascade and section/line isolation"
```

---

## Task 8: Schema GraphQL — quitar args/inputs accountId

**Files:**
- Modify: `infra/graphql/schema.graphql`

- [ ] **Step 1: Editar el schema** según el spec:
  - `getAccount(accountId: ID!)` → `getAccount`
  - `listClients(accountId: ID!, …)` → `listClients(limit: Int, nextToken: String)`
  - `getClient(accountId: ID!, clientId: ID!)` → `getClient(clientId: ID!)`
  - `getBankAccount(accountId: ID!, bankAccountId: ID!)` → `getBankAccount(bankAccountId: ID!)`
  - `deleteClient(accountId: ID!, clientId: ID!)` → `deleteClient(clientId: ID!)`
  - Quitar `accountId` de `PutAccountInput`, `PutClientInput`, `PutBankAccountInput`.

- [ ] **Step 2: Sintetizar para validar el schema**

Run: `cd infra && npx cdk synth AppFinances-Backend-dev > /dev/null && echo OK`
Expected: `OK` (AppSync valida que los resolvers referencian campos existentes).

- [ ] **Step 3: Commit**

```bash
git add infra/graphql/schema.graphql
git commit -m "feat(api): remove client-supplied accountId from GraphQL schema"
```

---

## Task 9: Frontend — dejar de enviar accountId y eliminar getNextInvoiceNumber

**Files:**
- Modify: `src/lib/appsync/invoices.ts`

- [ ] **Step 1: Quitar `getNextInvoiceNumber`**

Eliminar la función `getNextInvoiceNumber` (`src/lib/appsync/invoices.ts:373-377`) y sus usos: el número lo asigna el backend en `putInvoice`. Ajustar el formulario/acción de creación para no enviar `invoiceNumber` y leer el devuelto.

- [ ] **Step 2: Quitar `accountId` de variables** en cualquier query/mutation de clients/bank que lo pasara (en este módulo y en `src/lib/company.ts` si aplica).

- [ ] **Step 3: Typecheck/lint y build**

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/appsync/invoices.ts src/lib/company.ts src/actions/invoices.ts
git commit -m "refactor(web): stop sending accountId; server assigns invoice numbers"
```

---

## Task 10: Retirar tablas y data sources DynamoDB de dominio

**Files:**
- Modify: `infra/lib/stacks/backend-stack.ts`

- [ ] **Step 1: Eliminar del stack** las tablas DynamoDB de dominio (`invoices`, `invoice-sections`, `invoice-line-items`, `invoice-counters`, `accounts`, `clients`, `bank-accounts`) y sus data sources/resolvers viejos. **Conservar** `user-memberships` (futuro) y la futura `audit-log` (Plan 3). El bucket S3 y la Lambda PDF se mantienen.

> ⚠️ Hacerlo **solo tras** confirmar que el backfill (Plan 4) corrió y todos los resolvers leen Postgres. En `prod` las tablas tienen `RETAIN`, así que no se destruyen datos al quitarlas del stack.

- [ ] **Step 2: Synth y assertions CDK**

Run: `cd infra && npx vitest run test/backend-stack.test.ts && npx cdk synth AppFinances-Backend-dev > /dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add infra/lib/stacks/backend-stack.ts
git commit -m "chore(infra): remove DynamoDB domain tables now served by Postgres"
```

---

## Self-Review (completado por el autor del plan)

- **Cobertura del spec:** patrón de autorización (claim) ✓; quitar args `accountId` ✓; `listInvoices` sin Scan ✓; numeración atómica por cuenta ✓; cascada de borrado (FK + Task 7) ✓; `getInvoiceByNumber` scopeado ✓; aislamiento de secciones/líneas vía JOIN ✓; tests de aislamiento ✓. Audit log (Plan 3) y tokens/backfill (Plan 4) fuera de este plan, como en el spec.
- **Sin placeholders:** cada paso trae SQL/código/comando concretos. Task 6 step 3 y Task 7 step 4 reusan el patrón explícito de Task 4 (mismo `request/response`), no "similar a".
- **Consistencia de tipos:** los builders devuelven `SqlRequest` `{statement, params}` en todo el plan; los resolvers consumen `listClients/getClient/...` con la misma firma `(accountId, ctx.args)`; el helper `run()` de los tests interpreta `:name`.
- **Orden seguro:** los resolvers se conmutan a Postgres antes de retirar DynamoDB (Task 10 al final, tras backfill del Plan 4).

## Riesgos / notas de ejecución

- **Firma exacta de `@aws-appsync/utils/rds`:** el helper `sql`/`createPgStatement` puede requerir ajuste menor de wrapping (Task 4 step 1 lo nota). El SQL y los params (fuente de verdad, testeada) no cambian.
- **Tests de integración** requieren Docker + `docker-compose.test.yml` (Plan 1).
- **Secuencia de despliegue:** `cdk deploy` (Plan 1) → `db:migrate:aurora` (Task 3) → deploy resolvers → backfill (Plan 4) → retirar Dynamo (Task 10).

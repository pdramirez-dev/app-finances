# Foundation Plan 1 — DB, esquema y harness de pruebas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar la base no-disruptiva de la fundación multi-tenant: harness de pruebas, esquema Postgres con migraciones, cluster Aurora Serverless v2 con Data API, y el atributo `custom:accountId` en Cognito — sin tocar todavía los resolvers DynamoDB en uso.

**Architecture:** Se añade infraestructura en paralelo a la actual (additive): Aurora Serverless v2 (Postgres) + Data API + Secrets Manager en el stack CDK existente, y un atributo personalizado en el User Pool. El esquema relacional se versiona como archivos SQL aplicados por un runner; los tests de integración corren contra un Postgres local en Docker.

**Tech Stack:** TypeScript, AWS CDK (aws-cdk-lib), Aurora PostgreSQL Serverless v2 + RDS Data API, Cognito, Vitest, node-postgres (`pg`), Docker Compose.

**Spec:** `docs/superpowers/specs/2026-06-25-multi-tenant-foundation-design.md`

---

## File Structure

- `db/migrations/0001_init.sql` — DDL inicial (tablas, enums, índices, contador).
- `db/migrate.ts` — runner idempotente que aplica los `.sql` en orden contra una `DATABASE_URL`.
- `db/migrate.test.ts` — test de integración: aplica las migraciones a Postgres local y verifica tablas/constraints.
- `docker-compose.test.yml` — Postgres efímero para tests locales.
- `vitest.config.ts` — configuración de Vitest.
- `infra/lib/stacks/backend-stack.ts` — añadir Aurora Serverless v2 + Data API + atributo Cognito.
- `infra/test/backend-stack.test.ts` — assertions CDK (recurso Aurora con Data API, atributo Cognito).

---

## Task 1: Harness de pruebas (Vitest)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts + devDeps)

- [ ] **Step 1: Instalar Vitest y pg**

Run:
```bash
npm install -D vitest @types/pg && npm install pg
```
Expected: se añaden a `package.json`.

- [ ] **Step 2: Crear `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "infra/cdk.out"],
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 3: Añadir script de test en `package.json`**

En `"scripts"` agregar:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verificar que Vitest corre (sin tests aún)**

Run: `npx vitest run`
Expected: "No test files found" y exit 0 (o ejecución vacía sin error de config).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add Vitest harness and pg client"
```

---

## Task 2: Postgres local para tests

**Files:**
- Create: `docker-compose.test.yml`

- [ ] **Step 1: Crear `docker-compose.test.yml`**

```yaml
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app_finances_test
    ports:
      - "55432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app_finances_test"]
      interval: 2s
      timeout: 3s
      retries: 15
```

- [ ] **Step 2: Levantar y verificar healthcheck**

Run: `docker compose -f docker-compose.test.yml up -d && sleep 5 && docker compose -f docker-compose.test.yml ps`
Expected: el servicio `postgres-test` aparece como `healthy`.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.test.yml
git commit -m "test: add ephemeral Postgres for integration tests"
```

---

## Task 3: Esquema SQL inicial + runner de migraciones (TDD)

**Files:**
- Create: `db/migrations/0001_init.sql`
- Create: `db/migrate.ts`
- Test: `db/migrate.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`db/migrate.test.ts`:
```ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { Client } from "pg";
import { runMigrations } from "./migrate";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://app:app@localhost:55432/app_finances_test";

let client: Client;

beforeAll(async () => {
  await runMigrations(DATABASE_URL);
  client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
});

afterAll(async () => {
  await client?.end();
});

test("creates all domain tables", async () => {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  );
  const names = rows.map((r) => r.table_name);
  for (const t of [
    "accounts", "clients", "bank_accounts", "invoices",
    "invoice_sections", "invoice_line_items", "invoice_counters",
  ]) {
    expect(names).toContain(t);
  }
});

test("invoice_number is unique per account", async () => {
  const { rows } = await client.query(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'invoices'::regclass AND contype = 'u'`,
  );
  expect(rows.length).toBeGreaterThan(0);
});

test("running migrations twice is idempotent", async () => {
  await expect(runMigrations(DATABASE_URL)).resolves.not.toThrow();
});
```

- [ ] **Step 2: Correr el test para verque falla**

Run: `npx vitest run db/migrate.test.ts`
Expected: FAIL — no existe `./migrate` (`runMigrations` no definido).

- [ ] **Step 3: Escribir `db/migrations/0001_init.sql`**

Pegar el DDL completo del spec (sección "Modelo de datos"), envuelto para idempotencia:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('SELF_EMPLOYED', 'COMPANY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('DRAFT', 'SENT', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY,
  type account_type NOT NULL,
  display_name text NOT NULL,
  legal_name text, tax_id text, email text, phone text, address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  name text NOT NULL,
  email text, phone text, address text, tax_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clients_by_account_name ON clients (account_id, lower(name));

CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  beneficiary_name text NOT NULL,
  bank_name text NOT NULL,
  account_number_masked text, routing_number_masked text,
  iban_masked text, swift_code text,
  currency text NOT NULL, country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bank_accounts_by_account ON bank_accounts (account_id);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  client_id uuid REFERENCES clients(id),
  invoice_number int NOT NULL,
  date date NOT NULL,
  week_number int NOT NULL,
  bill_to_name text NOT NULL,
  bill_to_address text NOT NULL,
  project text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  grand_total numeric(14,2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS invoices_by_account_created ON invoices (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_by_account_status ON invoices (account_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS invoice_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  title text NOT NULL,
  position int NOT NULL,
  total numeric(14,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS sections_by_invoice ON invoice_sections (invoice_id, position);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES invoice_sections(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(14,2) NOT NULL,
  amount numeric(14,2) NOT NULL,
  position int NOT NULL
);
CREATE INDEX IF NOT EXISTS line_items_by_section ON invoice_line_items (section_id, position);

CREATE TABLE IF NOT EXISTS invoice_counters (
  account_id uuid PRIMARY KEY REFERENCES accounts(id),
  last_invoice_number int NOT NULL DEFAULT 0
);
```

- [ ] **Step 4: Escribir `db/migrate.ts`**

```ts
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = join(__dirname, "migrations");

export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const { rowCount } = await client.query(
        "SELECT 1 FROM schema_migrations WHERE version = $1",
        [version],
      );
      if (rowCount) continue;
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  runMigrations(url).then(() => console.log("migrations applied"));
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `docker compose -f docker-compose.test.yml up -d && npx vitest run db/migrate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add db/ docker-compose.test.yml
git commit -m "feat(db): add initial Postgres schema and idempotent migration runner"
```

---

## Task 4: Aurora Serverless v2 + Data API en CDK (TDD)

**Files:**
- Modify: `infra/lib/stacks/backend-stack.ts`
- Test: `infra/test/backend-stack.test.ts`

- [ ] **Step 1: Escribir el test CDK que falla**

`infra/test/backend-stack.test.ts`:
```ts
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { test, expect } from "vitest";
import { AppFinancesBackendStack } from "../lib/stacks/backend-stack";

function synth() {
  const app = new App();
  const stack = new AppFinancesBackendStack(app, "Test", {
    stage: "dev",
    callbackUrls: ["http://localhost:3000"],
    logoutUrls: ["http://localhost:3000"],
    env: { account: "111111111111", region: "us-east-1" },
  });
  return Template.fromStack(stack);
}

test("provisions an Aurora Serverless v2 Postgres cluster with Data API", () => {
  const t = synth();
  t.hasResourceProperties("AWS::RDS::DBCluster", {
    Engine: "aurora-postgresql",
    EnableHttpEndpoint: true,
  });
});
```
(Asegúrate de que Vitest también incluya `infra/test`; correr con `cwd` en `infra/` o un `vitest.config.ts` propio en `infra/`.)

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd infra && npx vitest run test/backend-stack.test.ts`
Expected: FAIL — no hay recurso `AWS::RDS::DBCluster` con `EnableHttpEndpoint`.

- [ ] **Step 3: Añadir el cluster Aurora en `backend-stack.ts`**

Importar y crear (cerca de las tablas existentes; el cluster es additive, no se borra nada aún):
```ts
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";

// dentro del constructor:
const dbVpc = new ec2.Vpc(this, "DbVpc", { maxAzs: 2, natGateways: 0 });

const dbCluster = new rds.DatabaseCluster(this, "DomainDb", {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_16_4,
  }),
  vpc: dbVpc,
  serverlessV2MinCapacity: 0,
  serverlessV2MaxCapacity: 2,
  enableDataApi: true,
  defaultDatabaseName: "app_finances",
  writer: rds.ClusterInstance.serverlessV2("Writer"),
  removalPolicy,
});

new cdk.CfnOutput(this, "DomainDbClusterArn", { value: dbCluster.clusterArn });
new cdk.CfnOutput(this, "DomainDbSecretArn", { value: dbCluster.secret!.secretArn });
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd infra && npx vitest run test/backend-stack.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar que el stack sintetiza**

Run: `cd infra && npx cdk synth AppFinances-Backend-dev > /dev/null && echo OK`
Expected: `OK` sin errores.

- [ ] **Step 6: Commit**

```bash
git add infra/lib/stacks/backend-stack.ts infra/test/backend-stack.test.ts infra/package.json
git commit -m "feat(infra): add Aurora Serverless v2 Postgres cluster with Data API"
```

---

## Task 5: Atributo `custom:accountId` en Cognito (TDD)

**Files:**
- Modify: `infra/lib/stacks/backend-stack.ts:263-281` (definición del `UserPool`)
- Test: `infra/test/backend-stack.test.ts`

- [ ] **Step 1: Añadir el test que falla**

Agregar a `infra/test/backend-stack.test.ts`:
```ts
test("user pool defines an immutable custom:accountId attribute", () => {
  const t = synth();
  t.hasResourceProperties("AWS::Cognito::UserPool", {
    Schema: Match.arrayWith([
      Match.objectLike({
        Name: "accountId",
        AttributeDataType: "String",
        Mutable: false,
      }),
    ]),
  });
});
```
Y añadir `Match` al import: `import { Match, Template } from "aws-cdk-lib/assertions";`

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd infra && npx vitest run test/backend-stack.test.ts`
Expected: FAIL — el UserPool no declara el atributo `accountId`.

- [ ] **Step 3: Añadir `customAttributes` al `UserPool`**

En la construcción del `new cognito.UserPool(...)`, agregar:
```ts
customAttributes: {
  accountId: new cognito.StringAttribute({ mutable: false }),
},
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd infra && npx vitest run test/backend-stack.test.ts`
Expected: PASS (ambos tests CDK).

- [ ] **Step 5: Commit**

```bash
git add infra/lib/stacks/backend-stack.ts infra/test/backend-stack.test.ts
git commit -m "feat(infra): add immutable custom:accountId attribute to Cognito user pool"
```

---

## Self-Review (completado por el autor del plan)

- **Cobertura del spec:** este plan cubre infra/DB + esquema + atributo Cognito + harness de pruebas. Resolvers, audit log, tokens y backfill quedan para los Planes 2–4 (declarado en el spec).
- **No-disruptivo:** todo es additive; no se eliminan tablas DynamoDB ni resolvers en uso, así la app sigue funcionando durante la migración.
- **Sin placeholders:** cada paso trae código/comando concreto.
- **Consistencia de tipos:** `runMigrations(databaseUrl)` se usa igual en test e implementación; nombres de tablas coinciden con el DDL del spec.

## Notas de ejecución

- Requiere Docker para los tests de integración de DB.
- El `vitest.config.ts` raíz excluye `infra/`; los tests CDK se corren desde `infra/` (Task 4–5 usan `cd infra`). Si se prefiere, añadir un `infra/vitest.config.ts` propio.
- La **aplicación de migraciones en Aurora (prod)** vía Data API se aborda en el Plan 2 (junto con el primer resolver que lee Postgres).

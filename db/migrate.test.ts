import { afterAll, beforeAll, expect, test } from "vitest";
import { Client } from "pg";
import { runMigrations } from "./migrate";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://app:app@localhost:55432/app_nexo_test";

const dbAvailable = await (async () => {
  const probe = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
  try {
    await probe.connect();
    await probe.end();
    return true;
  } catch {
    console.warn(`Skipping migration tests: no Postgres reachable at ${DATABASE_URL}`);
    return false;
  }
})();

let client: Client;

const baseTables = [
  "accounts",
  "clients",
  "bank_accounts",
  "invoices",
  "invoice_sections",
  "invoice_line_items",
  "invoice_counters",
];

const crmTables = [
  "contacts",
  "contact_favorites",
  "opportunities",
  "projects",
  "crm_tasks",
  "calendar_events",
  "payments",
  "bank_movements",
  "payment_reconciliations",
  "invoice_series",
];

beforeAll(async () => {
  if (!dbAvailable) return;
  await runMigrations(DATABASE_URL);
  client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
});

afterAll(async () => {
  await client?.end();
});

test.skipIf(!dbAvailable)("creates all domain tables", async () => {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  );
  const names = rows.map((r) => r.table_name);
  for (const t of [...baseTables, ...crmTables]) {
    expect(names).toContain(t);
  }
});

test.skipIf(!dbAvailable)("records the CRM migration", async () => {
  const { rows } = await client.query(
    "SELECT version FROM schema_migrations WHERE version = '0003_crm'",
  );
  expect(rows).toEqual([{ version: "0003_crm" }]);
});

test.skipIf(!dbAvailable)("lets Knex track every SQL migration without losing legacy history", async () => {
  const legacy = await client.query(
    "SELECT version FROM schema_migrations ORDER BY version",
  );
  expect(legacy.rows.map((row) => row.version)).toEqual([
    "0001_init",
    "0002_invoice_client_tenant_fk",
    "0003_crm",
    "0004_crm_financial_invariants",
    "0005_invoice_series",
    "0005b_invoice_version",
  ]);

  const knexHistory = await client.query(
    "SELECT name FROM knex_migrations ORDER BY name",
  );
  expect(knexHistory.rows.map((row) => row.name)).toEqual([
    "0001_init.sql",
    "0002_invoice_client_tenant_fk.sql",
    "0003_crm.sql",
    "0004_crm_financial_invariants.sql",
    "0005_invoice_series.sql",
    "0005b_invoice_version.sql",
  ]);
});

test.skipIf(!dbAvailable)("extends clients and invoices for CRM workflows", async () => {
  const { rows } = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (
         (table_name = 'clients' AND column_name = ANY($1::text[]))
         OR (table_name = 'invoices' AND column_name = 'due_date')
       )`,
    [["industry", "website", "status", "owner_user_id", "tags", "notes"]],
  );
  const columns = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
  for (const column of ["industry", "website", "status", "owner_user_id", "tags", "notes"]) {
    expect(columns).toContain(`clients.${column}`);
  }
  expect(columns).toContain("invoices.due_date");
});

test.skipIf(!dbAvailable)("gives every CRM table a tenant-scoped unique key", async () => {
  const { rows } = await client.query(
    `SELECT conrelid::regclass::text AS table_name, conname
     FROM pg_constraint
     WHERE contype = 'u' AND conname LIKE '%account_id_id_unique'`,
  );
  const constrainedTables = new Set(rows.map((row) => row.table_name));
  for (const table of crmTables) {
    expect(constrainedTables).toContain(table);
  }
  expect(constrainedTables).toContain("clients");
  expect(constrainedTables).toContain("invoices");
  expect(constrainedTables).toContain("bank_accounts");
});

test.skipIf(!dbAvailable)("uses composite tenant foreign keys for CRM relationships", async () => {
  const expectedConstraints = [
    "contacts_account_client_fk",
    "contact_favorites_account_contact_fk",
    "opportunities_account_client_fk",
    "opportunities_account_contact_fk",
    "projects_account_client_fk",
    "projects_account_opportunity_fk",
    "crm_tasks_account_client_fk",
    "crm_tasks_account_contact_fk",
    "crm_tasks_account_opportunity_fk",
    "crm_tasks_account_project_fk",
    "calendar_events_account_client_fk",
    "calendar_events_account_contact_fk",
    "calendar_events_account_opportunity_fk",
    "calendar_events_account_project_fk",
    "payments_account_invoice_fk",
    "payments_account_bank_account_fk",
    "bank_movements_account_bank_account_fk",
    "payment_reconciliations_account_payment_fk",
    "payment_reconciliations_account_movement_fk",
  ];
  const { rows } = await client.query(
    `SELECT conname FROM pg_constraint WHERE contype = 'f' AND conname = ANY($1::text[])`,
    [expectedConstraints],
  );
  expect(new Set(rows.map((row) => row.conname))).toEqual(new Set(expectedConstraints));
});

test.skipIf(!dbAvailable)("defines the canonical payment states", async () => {
  const { rows } = await client.query(
    `SELECT enumlabel
     FROM pg_enum
     JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
     WHERE pg_type.typname = 'payment_status'
     ORDER BY enumsortorder`,
  );
  expect(rows.map((row) => row.enumlabel)).toEqual([
    "UNRECONCILED",
    "RECONCILED",
    "VOIDED",
  ]);
});

test.skipIf(!dbAvailable)("installs financial idempotency and reconciliation guards", async () => {
  const constraints = await client.query(
    `SELECT conname FROM pg_constraint
     WHERE conname IN (
       'payments_account_reference_unique',
       'payments_void_metadata_complete',
       'invoices_due_date_not_before_issue',
       'payment_reconciliations_reversal_complete'
     )`,
  );
  expect(new Set(constraints.rows.map((row) => row.conname))).toEqual(new Set([
    "payments_account_reference_unique",
    "payments_void_metadata_complete",
    "invoices_due_date_not_before_issue",
    "payment_reconciliations_reversal_complete",
  ]));

  const triggers = await client.query(
    `SELECT tgname FROM pg_trigger
     WHERE NOT tgisinternal
       AND tgname IN ('payment_reconciliation_validate', 'payment_reconciliation_sync')`,
  );
  expect(new Set(triggers.rows.map((row) => row.tgname))).toEqual(new Set([
    "payment_reconciliation_validate",
    "payment_reconciliation_sync",
  ]));
});

test.skipIf(!dbAvailable)("invoice_number is unique per account", async () => {
  const { rows } = await client.query(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'invoices'::regclass AND contype = 'u'`,
  );
  expect(rows.length).toBeGreaterThan(0);
});

test.skipIf(!dbAvailable)("invoice clients are constrained to the same account", async () => {
  const { rows } = await client.query(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'invoices'::regclass AND conname = 'invoices_account_client_fk'`,
  );
  expect(rows).toHaveLength(1);
});

test.skipIf(!dbAvailable)("running migrations twice is idempotent", async () => {
  await expect(runMigrations(DATABASE_URL)).resolves.not.toThrow();
});

test.skipIf(!dbAvailable)("numbers invoices per series instead of per account", async () => {
  const { rows } = await client.query(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'invoices'::regclass AND contype = 'u'`,
  );
  const names = rows.map((row) => row.conname);
  expect(names).toContain("invoices_account_series_number_unique");
  expect(names.filter((name) => /invoice_number_key$/.test(name))).toEqual([]);
});

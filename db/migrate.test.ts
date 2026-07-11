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

test("invoice clients are constrained to the same account", async () => {
  const { rows } = await client.query(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'invoices'::regclass AND conname = 'invoices_account_client_fk'`,
  );
  expect(rows).toHaveLength(1);
});

test("running migrations twice is idempotent", async () => {
  await expect(runMigrations(DATABASE_URL)).resolves.not.toThrow();
});

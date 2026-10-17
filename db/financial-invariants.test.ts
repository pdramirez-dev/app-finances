import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { Client } from "pg";

import { runMigrations } from "./migrate";

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:55432/app_nexo_test";

const dbAvailable = await (async () => {
  const probe = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
  try {
    await probe.connect();
    await probe.end();
    return true;
  } catch {
    return false;
  }
})();

let db: Client;

beforeAll(async () => {
  if (!dbAvailable) return;
  await runMigrations(DATABASE_URL);
  db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
});

afterAll(async () => {
  await db?.end();
});

test.skipIf(!dbAvailable)("reconciliation is bounded, updates statuses, and reverses without deleting history", async () => {
  const accountId = randomUUID();
  const invoiceId = randomUUID();
  const paymentId = randomUUID();
  const movementId = randomUUID();
  const reconciliationId = randomUUID();

  await db.query("BEGIN");
  try {
    await db.query("INSERT INTO accounts (id, type, display_name) VALUES ($1, 'COMPANY', 'Financial test')", [accountId]);
    await db.query(
      `INSERT INTO invoices (id, account_id, invoice_number, date, due_date, week_number,
        bill_to_name, bill_to_address, project, currency, grand_total, status)
       VALUES ($1, $2, 1, '2026-07-01', '2026-07-31', 27, 'Client', 'Address', 'Project', 'USD', 100, 'SENT')`,
      [invoiceId, accountId],
    );
    await db.query(
      `INSERT INTO payments (id, account_id, invoice_id, amount, currency, method, reference)
       VALUES ($1, $2, $3, 100, 'USD', 'ACH', 'TEST-REF')`,
      [paymentId, accountId, invoiceId],
    );
    await db.query(
      `INSERT INTO bank_movements (id, account_id, description, amount, currency, booked_on)
       VALUES ($1, $2, 'Deposit', 100, 'USD', '2026-07-12')`,
      [movementId, accountId],
    );
    await db.query(
      `INSERT INTO payment_reconciliations
        (id, account_id, payment_id, bank_movement_id, allocated_amount, reconciled_by)
       VALUES ($1, $2, $3, $4, 100, 'admin-user')`,
      [reconciliationId, accountId, paymentId, movementId],
    );

    expect((await db.query("SELECT status FROM payments WHERE id = $1", [paymentId])).rows[0].status).toBe("RECONCILED");
    expect((await db.query("SELECT status FROM invoices WHERE id = $1", [invoiceId])).rows[0].status).toBe("PAID");

    await db.query(
      `UPDATE payment_reconciliations
       SET reversed_at = now(), reversed_by = 'admin-user', reversal_reason = 'Bank returned transfer'
       WHERE id = $1`,
      [reconciliationId],
    );

    expect((await db.query("SELECT status FROM payments WHERE id = $1", [paymentId])).rows[0].status).toBe("UNRECONCILED");
    expect((await db.query("SELECT status FROM invoices WHERE id = $1", [invoiceId])).rows[0].status).toBe("SENT");
    expect((await db.query("SELECT count(*)::int AS count FROM payment_reconciliations WHERE id = $1", [reconciliationId])).rows[0].count).toBe(1);

    await db.query("SAVEPOINT before_ledger_delete");
    await expect(db.query("DELETE FROM payment_reconciliations WHERE id = $1", [reconciliationId]))
      .rejects.toThrow(/append-only/);
    await db.query("ROLLBACK TO SAVEPOINT before_ledger_delete");

    await db.query("SAVEPOINT before_ledger_tamper");
    await expect(db.query(
      "UPDATE payment_reconciliations SET reconciled_by = 'another-user' WHERE id = $1",
      [reconciliationId],
    )).rejects.toThrow(/immutable/);
    await db.query("ROLLBACK TO SAVEPOINT before_ledger_tamper");
  } finally {
    await db.query("ROLLBACK");
  }
});

test.skipIf(!dbAvailable)("payment references are idempotent and over-allocation is rejected", async () => {
  const accountId = randomUUID();
  const invoiceId = randomUUID();
  const paymentId = randomUUID();
  const firstMovement = randomUUID();
  const secondMovement = randomUUID();

  await db.query("BEGIN");
  try {
    await db.query("INSERT INTO accounts (id, type, display_name) VALUES ($1, 'COMPANY', 'Guard test')", [accountId]);
    await db.query(
      `INSERT INTO invoices (id, account_id, invoice_number, date, week_number, bill_to_name,
        bill_to_address, project, currency, grand_total, status)
       VALUES ($1, $2, 1, '2026-07-01', 27, 'Client', 'Address', 'Project', 'USD', 100, 'SENT')`,
      [invoiceId, accountId],
    );
    await db.query(
      `INSERT INTO payments (id, account_id, invoice_id, amount, currency, method, reference)
       VALUES ($1, $2, $3, 100, 'USD', 'ACH', 'IDEMPOTENT-REF')`,
      [paymentId, accountId, invoiceId],
    );
    await expect(db.query(
      `INSERT INTO payments (account_id, invoice_id, amount, currency, method, reference)
       VALUES ($1, $2, 100, 'USD', 'ACH', 'IDEMPOTENT-REF')`,
      [accountId, invoiceId],
    )).rejects.toThrow();
  } finally {
    await db.query("ROLLBACK");
  }

  await db.query("BEGIN");
  try {
    await db.query("INSERT INTO accounts (id, type, display_name) VALUES ($1, 'COMPANY', 'Allocation test')", [accountId]);
    await db.query(
      `INSERT INTO invoices (id, account_id, invoice_number, date, week_number, bill_to_name,
        bill_to_address, project, currency, grand_total, status)
       VALUES ($1, $2, 1, '2026-07-01', 27, 'Client', 'Address', 'Project', 'USD', 100, 'SENT')`,
      [invoiceId, accountId],
    );
    await db.query(
      `INSERT INTO payments (id, account_id, invoice_id, amount, currency, method, reference)
       VALUES ($1, $2, $3, 100, 'USD', 'ACH', 'ALLOCATION-REF')`,
      [paymentId, accountId, invoiceId],
    );
    await db.query(
      `INSERT INTO bank_movements (id, account_id, description, amount, currency, booked_on)
       VALUES ($1, $3, 'First', 100, 'USD', '2026-07-12'), ($2, $3, 'Second', 100, 'USD', '2026-07-12')`,
      [firstMovement, secondMovement, accountId],
    );
    await db.query(
      `INSERT INTO payment_reconciliations (account_id, payment_id, bank_movement_id, allocated_amount, reconciled_by)
       VALUES ($1, $2, $3, 60, 'admin-user')`,
      [accountId, paymentId, firstMovement],
    );
    await db.query("SAVEPOINT before_overallocation");
    await expect(db.query(
      `INSERT INTO payment_reconciliations (account_id, payment_id, bank_movement_id, allocated_amount, reconciled_by)
       VALUES ($1, $2, $3, 41, 'admin-user')`,
      [accountId, paymentId, secondMovement],
    )).rejects.toThrow(/exceeds the payment amount/);
    await db.query("ROLLBACK TO SAVEPOINT before_overallocation");
  } finally {
    await db.query("ROLLBACK");
  }
});

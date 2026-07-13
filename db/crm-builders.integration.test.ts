import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import { Client, type QueryResultRow } from "pg";

import {
  getCrmSummary,
  putBankMovement,
  putCalendarEvent,
  putContact,
  putOpportunity,
  putProject,
  putTask,
  reconcilePayment,
  registerPayment,
  searchWorkspace,
  undoReconciliation,
} from "../infra/graphql/resolvers/src/lib/crm-sql-builders";
import type { SqlRequest } from "../infra/graphql/resolvers/src/lib/sql-builders";
import { runMigrations } from "./migrate";

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:55432/app_finances_test";

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

function bind(request: SqlRequest) {
  const names: string[] = [];
  const text = request.statement.replace(/(?<!:):([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => {
    let index = names.indexOf(name);
    if (index === -1) {
      names.push(name);
      index = names.length - 1;
    }
    return `$${index + 1}`;
  });
  return { text, values: names.map((name) => request.params[name]) };
}

async function execute<T extends QueryResultRow = QueryResultRow>(request: SqlRequest) {
  return db.query<T>(bind(request));
}

beforeAll(async () => {
  if (!dbAvailable) return;
  await runMigrations(DATABASE_URL);
  db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
});

afterAll(async () => {
  await db?.end();
});

test.skipIf(!dbAvailable)("executes the complete CRM SQL workflow against PostgreSQL", async () => {
  const accountId = randomUUID();
  const clientId = randomUUID();
  const invoiceId = randomUUID();
  const userId = "integration-admin";

  await db.query("BEGIN");
  try {
    await db.query("INSERT INTO accounts (id, type, display_name) VALUES ($1, 'COMPANY', 'CRM integration')", [accountId]);
    await db.query("INSERT INTO clients (id, account_id, name) VALUES ($1, $2, 'Acme Operations')", [clientId, accountId]);
    await db.query(
      `INSERT INTO invoices (id, account_id, client_id, invoice_number, date, due_date, week_number,
        bill_to_name, bill_to_address, project, currency, grand_total, status)
       VALUES ($1, $2, $3, 1, '2026-07-01', '2026-07-31', 27,
        'Acme Operations', '100 Main St', 'CRM rollout', 'USD', 125, 'SENT')`,
      [invoiceId, accountId, clientId],
    );

    const contact = (await execute(putContact(accountId, { input: {
      clientId, name: "Ada Lovelace", email: "ada@example.com", kind: "CLIENT",
    } }, userId))).rows[0];
    expect(contact.contactId).toBeTruthy();

    const opportunity = (await execute(putOpportunity(accountId, { input: {
      clientId, contactId: contact.contactId, title: "Expansion", value: 2000,
      stage: "QUALIFIED", probability: 40, source: "REFERRAL",
    } }, userId))).rows[0];
    expect(opportunity.opportunityId).toBeTruthy();

    const project = (await execute(putProject(accountId, { input: {
      clientId, opportunityId: opportunity.opportunityId, name: "Expansion delivery",
      budget: 2000, spent: 250, status: "IN_PROGRESS", progress: 25,
    } }, userId))).rows[0];
    expect(project.projectId).toBeTruthy();

    const task = (await execute(putTask(accountId, { input: {
      title: "Confirm kickoff", projectId: project.projectId, clientId,
      dueAt: "2026-07-15T14:00:00.000Z", status: "PENDING",
    } }, userId))).rows[0];
    expect(task.taskId).toBeTruthy();

    const event = (await execute(putCalendarEvent(accountId, { input: {
      title: "Kickoff", clientId, projectId: project.projectId,
      startsAt: "2026-07-16T14:00:00.000Z", endsAt: "2026-07-16T15:00:00.000Z",
    } }, userId))).rows[0];
    expect(event.eventId).toBeTruthy();

    const payment = (await execute(registerPayment(accountId, { input: {
      invoiceId, amount: 125, currency: "USD", method: "ACH", reference: "CRM-E2E-1",
    } }))).rows[0];
    expect(payment.status).toBe("UNRECONCILED");

    const movement = (await execute(putBankMovement(accountId, { input: {
      externalId: "bank-event-1", description: "Acme Operations", reference: "CRM-E2E-1",
      amount: 125, currency: "USD", bookedOn: "2026-07-12", rawPayload: { source: "test" },
    } }))).rows[0];
    expect(movement.movementId).toBeTruthy();

    const reconciled = (await execute(reconcilePayment(accountId, {
      paymentId: payment.paymentId, movementId: movement.movementId, allocatedAmount: 125,
    }, userId))).rows[0];
    expect(reconciled.paymentId).toBe(payment.paymentId);
    expect(reconciled.status).toBe("RECONCILED");
    expect((await db.query("SELECT status FROM payments WHERE id = $1", [payment.paymentId])).rows[0].status).toBe("RECONCILED");

    const summary = (await execute(getCrmSummary(accountId))).rows[0];
    expect(summary).toMatchObject({ totalClients: 1, activeContacts: 1, activeProjects: 1 });
    expect(Number(summary.collectedAmount)).toBe(125);

    const search = await execute(searchWorkspace(accountId, { query: "Expansion", limit: 10, offset: 0 }));
    expect(search.rows.map((row) => row.entityType)).toEqual(expect.arrayContaining(["OPPORTUNITY", "PROJECT"]));

    const undone = (await execute(undoReconciliation(accountId, {
      paymentId: payment.paymentId, movementId: movement.movementId, reason: "Integration reversal",
    }, userId))).rows[0];
    expect(undone.paymentId).toBe(payment.paymentId);
    expect(undone.status).toBe("UNRECONCILED");
    expect((await db.query("SELECT status FROM payments WHERE id = $1", [payment.paymentId])).rows[0].status).toBe("UNRECONCILED");
  } finally {
    await db.query("ROLLBACK");
  }
});

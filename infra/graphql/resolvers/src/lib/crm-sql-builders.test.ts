import { describe, expect, test } from "vitest";
import {
  deleteCalendarEvent,
  deleteContact,
  deleteOpportunity,
  deleteProject,
  deleteTask,
  getCalendarEvent,
  getContact,
  getCrmSummary,
  getOpportunity,
  getPayment,
  getProject,
  getTask,
  listBankMovements,
  listCalendarEvents,
  listContacts,
  listOpportunities,
  listPayments,
  listProjects,
  listTasks,
  putBankMovement,
  putCalendarEvent,
  putContact,
  putOpportunity,
  putProject,
  putTask,
  reconcilePayment,
  registerPayment,
  searchWorkspace,
  setContactFavorite,
  setTaskCompleted,
  undoReconciliation,
  updateOpportunityStage,
  updateProjectStatus,
  voidPayment,
} from "./crm-sql-builders";

const ACC = "account-a";
const USER = "user-a";

describe("CRM tenant isolation", () => {
  test("all get builders use the claim account and entity id", () => {
    const requests = [
      getContact(ACC, { contactId: "c" }, USER),
      getOpportunity(ACC, { opportunityId: "o" }),
      getProject(ACC, { projectId: "p" }),
      getTask(ACC, { taskId: "t" }),
      getCalendarEvent(ACC, { eventId: "e" }),
      getPayment(ACC, { paymentId: "pay" }),
    ];
    for (const request of requests) {
      expect(request.statement).toMatch(/account_id\s*=\s*:acc/i);
      expect(request.statement).toMatch(/\.id\s*=\s*:id/i);
      expect(request.params.acc).toBe(ACC);
    }
  });

  test("all list builders paginate by offset with a stable id tie-breaker", () => {
    const requests = [
      listContacts(ACC, { limit: 7, offset: 14 }, USER),
      listOpportunities(ACC, { limit: 7, offset: 14 }),
      listProjects(ACC, { limit: 7, offset: 14 }),
      listTasks(ACC, { limit: 7, offset: 14 }),
      listCalendarEvents(ACC, { from: "2026-01-01", to: "2027-01-01", limit: 7, offset: 14 }),
      listPayments(ACC, { limit: 7, offset: 14 }),
      listBankMovements(ACC, { limit: 7, offset: 14 }),
    ];
    for (const request of requests) {
      expect(request.statement).toMatch(/account_id\s*=\s*:acc/i);
      expect(request.statement).toMatch(/ORDER BY[\s\S]*\bid\b[\s\S]*LIMIT :lim OFFSET :off/i);
      expect(request.params).toMatchObject({ acc: ACC, lim: 7, off: 14 });
    }
  });

  test("upserts cannot update an id owned by another account", () => {
    const requests = [
      putContact(ACC, { input: { contactId: "c", name: "C" } }, USER),
      putOpportunity(ACC, { input: { opportunityId: "o", title: "O", value: 1 } }, USER),
      putProject(ACC, { input: { projectId: "p", clientId: "c", name: "P" } }, USER),
      putTask(ACC, { input: { taskId: "t", title: "T" } }, USER),
      putCalendarEvent(ACC, { input: { eventId: "e", title: "E", startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-01T01:00:00Z" } }, USER),
      putBankMovement(ACC, { input: { movementId: "m", description: "M", amount: 1, bookedOn: "2026-01-01" } }),
    ];
    const tables = ["contacts", "opportunities", "projects", "crm_tasks", "calendar_events", "bank_movements"];
    requests.forEach((request, index) => {
      expect(request.statement).toMatch(/ON CONFLICT \(id\) DO UPDATE/i);
      expect(request.statement).toMatch(new RegExp(`WHERE ${tables[index]}\\.account_id = :acc`, "i"));
      expect(request.params.acc).toBe(ACC);
    });
  });

  test("deletes are account scoped and return a row only on success", () => {
    const requests = [
      deleteContact(ACC, { contactId: "c" }),
      deleteOpportunity(ACC, { opportunityId: "o" }),
      deleteProject(ACC, { projectId: "p" }),
      deleteTask(ACC, { taskId: "t" }),
      deleteCalendarEvent(ACC, { eventId: "e" }),
    ];
    for (const request of requests) {
      expect(request.statement).toMatch(/DELETE FROM[\s\S]*account_id = :acc[\s\S]*id = :id[\s\S]*RETURNING/i);
      expect(request.params.acc).toBe(ACC);
    }
  });
});

describe("CRM actions", () => {
  test("favorites are scoped to both account and requesting user", () => {
    const add = setContactFavorite(ACC, { contactId: "c", favorite: true }, USER);
    const remove = setContactFavorite(ACC, { contactId: "c", favorite: false }, USER);
    expect(add.statement).toMatch(/ON CONFLICT \(account_id, contact_id, user_id\) DO NOTHING/i);
    expect(remove.statement).toMatch(/DELETE FROM contact_favorites[\s\S]*account_id = :acc[\s\S]*user_id = :userId/i);
    expect(add.params).toMatchObject({ acc: ACC, userId: USER });
    expect(remove.params).toMatchObject({ acc: ACC, userId: USER });
  });

  test("stage, project status, and task completion updates remain tenant scoped", () => {
    const actions = [
      updateOpportunityStage(ACC, { opportunityId: "o", stage: "WON" }),
      updateProjectStatus(ACC, { projectId: "p", status: "COMPLETED" }),
      setTaskCompleted(ACC, { taskId: "t", completed: true }),
    ];
    for (const action of actions) {
      expect(action.statement).toMatch(/account_id = :acc/i);
      expect(action.statement).toMatch(/RETURNING/i);
      expect(action.params.acc).toBe(ACC);
    }
    expect(actions[0].statement).toMatch(/closed_at/i);
    expect(actions[1].statement).toMatch(/progress[\s\S]*100/i);
    expect(actions[2].statement).toMatch(/completed_at[\s\S]*now\(\)/i);
  });
});

describe("payments and reconciliation", () => {
  test("payment registration is idempotent per account and reference", () => {
    const request = registerPayment(ACC, { input: { invoiceId: "i", amount: 10, method: "ACH", reference: "REF-1" } });
    expect(request.statement).toMatch(/invoices i[\s\S]*i\.account_id = :acc/i);
    expect(request.statement).toMatch(/bank_accounts b[\s\S]*b\.account_id = :acc/i);
    expect(request.statement).toMatch(/ON CONFLICT \(account_id, reference\) DO UPDATE/i);
    expect(request.statement).toMatch(/payments\.invoice_id = EXCLUDED\.invoice_id/i);
    expect(request.params).toMatchObject({ acc: ACC, reference: "REF-1" });
  });

  test("void records actor/reason and refuses active reconciliations", () => {
    const request = voidPayment(ACC, { paymentId: "p", reason: "duplicate" }, USER);
    expect(request.statement).toMatch(/status = 'VOIDED'/i);
    expect(request.statement).toMatch(/voided_by = :userId/i);
    expect(request.statement).toMatch(/void_reason = :reason/i);
    expect(request.statement).toMatch(/NOT EXISTS[\s\S]*reversed_at IS NULL/i);
    expect(request.params).toMatchObject({ acc: ACC, userId: USER, reason: "duplicate" });
  });

  test("bank movement JSON is serialized, cast to jsonb, and never returned", () => {
    const payload = { source: "bank", nested: { id: 7 } };
    const request = putBankMovement(ACC, { input: { description: "credit", amount: 20, bookedOn: "2026-01-01", rawPayload: payload } });
    expect(request.params.rawPayload).toBe(JSON.stringify(payload));
    expect(request.statement).toMatch(/(?:CAST\(:rawPayload AS jsonb\)|:rawPayload::jsonb)/i);
    const select = request.statement.slice(request.statement.lastIndexOf("SELECT"));
    expect(select).not.toMatch(/raw_payload|rawPayload/i);
    expect(request.statement).toMatch(/payment_reconciliations[\s\S]*reversed_at IS NULL/i);
  });

  test("reconcile locks scoped rows and enforces status, currency, sign, balances, and actor", () => {
    const request = reconcilePayment(ACC, { paymentId: "p", movementId: "m" }, USER);
    expect(request.statement).toMatch(/payments p WHERE p\.account_id = :acc[\s\S]*FOR UPDATE/i);
    expect(request.statement).toMatch(/bank_movements m WHERE m\.account_id = :acc[\s\S]*FOR UPDATE/i);
    expect(request.statement).toMatch(/p\.status <> 'VOIDED'/i);
    expect(request.statement).toMatch(/upper\(p\.currency\) = upper\(m\.currency\)/i);
    expect(request.statement).toMatch(/m\.amount > 0/i);
    expect(request.statement).toMatch(/LEAST\(payment_remaining, movement_remaining\)/i);
    expect(request.statement).toMatch(/<= LEAST\(payment_remaining, movement_remaining\)/i);
    expect(request.statement).toMatch(/reversed_at IS NULL/i);
    expect(request.statement).toMatch(/ON CONFLICT DO NOTHING/i);
    expect(request.statement).toMatch(/target\.new_allocation >= p\.amount[\s\S]*AS status/i);
    expect(request.params).toMatchObject({ acc: ACC, userId: USER, allocatedAmount: null });
  });

  test("undo is append-only: it marks reversal metadata and never deletes ledger rows", () => {
    const request = undoReconciliation(ACC, { paymentId: "p", movementId: "m", reason: "wrong match" }, USER);
    expect(request.statement).toMatch(/UPDATE payment_reconciliations SET reversed_at = now\(\)/i);
    expect(request.statement).toMatch(/reversed_by = :userId/i);
    expect(request.statement).toMatch(/reversal_reason = :reason/i);
    expect(request.statement).toMatch(/reversed_at IS NULL/i);
    expect(request.statement).toMatch(/active\.id <> r\.reconciliation_id[\s\S]*AS status/i);
    expect(request.statement).not.toMatch(/DELETE FROM payment_reconciliations/i);
    expect(request.params).toMatchObject({ acc: ACC, userId: USER, reason: "wrong match" });
  });

  test("movement reconciliation totals ignore reversed ledger entries", () => {
    const request = listBankMovements(ACC, { reconciled: false });
    expect(request.statement).toMatch(/payment_reconciliations[\s\S]*reversed_at IS NULL/i);
    expect(request.statement).toMatch(/m\.amount > 0/i);
  });
});

describe("summary and workspace search", () => {
  test("summary scopes every metric and reports its USD aggregation currency", () => {
    const request = getCrmSummary(ACC);
    expect(request.params.acc).toBe(ACC);
    expect(request.statement.match(/account_id = :acc/g)?.length).toBeGreaterThanOrEqual(10);
    expect(request.statement).toMatch(/reversed_at IS NULL/i);
    expect(request.statement).toMatch(/'USD' AS currency/i);
  });

  test("workspace search scopes all eight entity branches and paginates", () => {
    const request = searchWorkspace(ACC, { query: "acme", limit: 5, offset: 10 });
    expect(request.statement.match(/account_id = :acc/g)).toHaveLength(8);
    expect(request.statement).toMatch(/ORDER BY[\s\S]*"entityId" DESC LIMIT :lim OFFSET :off/i);
    expect(request.params).toMatchObject({ acc: ACC, term: "%acme%", lim: 5, off: 10 });
  });
});

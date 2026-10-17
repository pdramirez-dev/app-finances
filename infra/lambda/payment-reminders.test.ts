import { expect, test } from "vitest";
import { createPaymentRemindersHandler, type PaymentRemindersDeps } from "./payment-reminders";

const NOW = new Date("2026-02-17T14:00:00Z");

const document = (invoiceId: string, overrides: Record<string, unknown> = {}) => ({
  clientEmail: `${invoiceId.toLowerCase()}@cliente.example`, remindersEnabled: true, ...documentDefaults(invoiceId), ...overrides,
});

const documentDefaults = (invoiceId: string) => ({
  invoiceId, status: "SENT", invoiceLabel: invoiceId, date: "2026-01-15", dueDate: "2026-02-10", weekNumber: 3,
  billToName: "Cliente", billToAddress: "Addr", project: "P", currency: "USD", grandTotal: "100", balanceDue: "60",
  issuerName: "Nexo", sectionsJson: "[]", bankJson: null,
});

function setup(
  dueRows: Array<Record<string, unknown>>,
  overrides: Partial<PaymentRemindersDeps> = {},
  documents: Record<string, Record<string, unknown>> = {},
) {
  const calls = { claims: [] as string[], completions: [] as Array<[string, boolean]>, emails: [] as any[], logs: [] as any[], selection: [] as any[] };
  const deps: PaymentRemindersDeps = {
    async runSql(request) {
      const sql = request.statement;
      if (sql.includes("DISTINCT ON")) { calls.selection.push(request.params); return dueRows; }
      if (sql.includes("INSERT INTO invoice_reminders")) {
        calls.claims.push(`${request.params.acc}:${request.params.invoiceId}`);
        return request.params.invoiceId === "TAKEN" ? [] : [{ reminderId: `R-${request.params.invoiceId}` }];
      }
      if (sql.includes("UPDATE invoice_reminders")) {
        calls.completions.push([String(request.params.reminderId), Boolean(request.params.sent)]);
        return [{}];
      }
      const invoiceId = String(request.params.invoiceId);
      return [document(invoiceId, documents[invoiceId])];
    },
    async putPdf() {},
    async sendEmail(email) {
      if (email.to === "boom@cliente.example") throw new Error("SES rejected");
      calls.emails.push(email);
    },
    async getLinkSecret() { return "test-secret-with-enough-entropy-0123456789"; },
    sender: "Facturas <f@nexo.example>",
    downloadBaseUrl: "https://dl.example",
    now: () => NOW,
    remainingTimeMs: () => 600_000,
    log: (entry) => calls.logs.push(entry),
    ...overrides,
  };
  return { deps, calls };
}

const row = (invoiceId: string, accountId: string, recipient: string | null) =>
  ({ invoiceId, accountId, recipient, offsetDays: 7, scheduledFor: "2026-02-17" });

test("does nothing, without failing, when no sender is configured", async () => {
  const { deps, calls } = setup([row("A", "ACC1", "a@cliente.example")], { sender: undefined });
  const summary = await createPaymentRemindersHandler(deps)();
  expect(summary.notConfigured).toBe(true);
  expect(calls.selection).toHaveLength(0);
  expect(calls.logs[0]).toMatchObject({ reason: "sender_not_configured" });
});

test("claims each reminder in its own account, sends it, and keeps going after failures", async () => {
  const { deps, calls } = setup([
    row("A", "ACC1", "a@cliente.example"),
    row("B", "ACC2", null),
    row("TAKEN", "ACC1", "t@cliente.example"),
    row("C", "ACC2", "boom@cliente.example"),
    row("D", "ACC2", "d@cliente.example"),
  ], {}, { TAKEN: { clientEmail: "t@cliente.example" }, C: { clientEmail: "boom@cliente.example" } });
  const summary = await createPaymentRemindersHandler(deps)();

  expect(summary).toMatchObject({ selected: 5, sent: 2, failed: 1, skippedNoEmail: 1, skippedAlreadyClaimed: 1, skippedNoLongerDue: 0, stoppedEarly: false });
  expect(calls.selection[0]).toMatchObject({ today: "2026-02-17", windowDays: 3, minGapSince: "2026-02-15T14:00:00.000Z" });
  expect(calls.claims).toEqual(["ACC1:A", "ACC1:TAKEN", "ACC2:C", "ACC2:D"]);
  expect(calls.completions).toEqual([["R-A", true], ["R-C", false], ["R-D", true]]);
  expect(calls.emails.map((email) => email.to)).toEqual(["a@cliente.example", "d@cliente.example"]);
  expect(calls.emails[0].subject).toMatch(/^Recordatorio de pago/);
  expect(calls.emails[0].text).toContain("venció el 02/10/2026 (hace 7 días)");
  expect(calls.logs.find((entry) => entry.event === "payment_reminder_failed")).toMatchObject({ accountId: "ACC2", invoiceId: "C" });
});

test("stops before the Lambda deadline and leaves the rest for the next run", async () => {
  let remaining = 40_000;
  const { deps, calls } = setup([row("A", "ACC1", "a@cliente.example"), row("B", "ACC1", "b@cliente.example")], {
    remainingTimeMs: () => {
      const value = remaining;
      remaining -= 15_000;
      return value;
    },
  });
  const summary = await createPaymentRemindersHandler(deps)();
  expect(summary).toMatchObject({ sent: 1, stoppedEarly: true });
  expect(calls.claims).toEqual(["ACC1:A"]);
});

test("re-checks each invoice right before sending and skips the ones that changed", async () => {
  const { deps, calls } = setup([
    row("PAID", "ACC1", "paid@cliente.example"),
    row("SETTLED", "ACC1", "settled@cliente.example"),
    row("MOVED", "ACC1", "moved@cliente.example"),
    row("OFF", "ACC2", "off@cliente.example"),
    row("GONE", "ACC2", "gone@cliente.example"),
    row("OK", "ACC2", "ok@cliente.example"),
  ], {}, {
    PAID: { status: "PAID" },
    SETTLED: { balanceDue: "0.00" },
    MOVED: { clientEmail: "new-owner@otro-cliente.example" },
    OFF: { remindersEnabled: false },
  });
  const runSql = deps.runSql;
  deps.runSql = async (request) => (request.params.invoiceId === "GONE" && request.statement.includes("sectionsJson") ? [] : runSql(request));

  const summary = await createPaymentRemindersHandler(deps)();
  expect(summary).toMatchObject({ sent: 1, failed: 0, skippedNoLongerDue: 5 });
  expect(calls.claims).toEqual(["ACC2:OK"]);
  expect(calls.emails.map((email) => email.to)).toEqual(["ok@cliente.example"]);
});

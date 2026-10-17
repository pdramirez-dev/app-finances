import { PDFDocument } from "pdf-lib";
import { expect, test } from "vitest";
import { createDownloadInvoiceHandler } from "./download-invoice";
import { verifyInvoiceLinkToken } from "./lib/invoice-link-token";
import { createSendInvoiceEmailHandler, type SendInvoiceEmailDeps } from "./send-invoice-email";

const SECRET = "test-secret-with-enough-entropy-0123456789";
const NOW = new Date("2026-10-16T12:00:00Z");

const documentRow = (status = "DRAFT") => ({
  invoiceId: "INV", status, invoiceLabel: "A-0050", date: "2026-10-16", dueDate: "2026-11-15", weekNumber: 42,
  billToName: "Cliente <b>", billToAddress: "1 Main St", project: "P", currency: "USD", notes: null, grandTotal: "1500.00",
  balanceDue: "1000.00",
  issuerName: "Nexo Demo", issuerLegalName: null, issuerEmail: "billing@nexo.example",
  bankJson: null, sectionsJson: JSON.stringify([{ title: "S", total: 1500, lineItems: [{ description: "d", quantity: 1, amount: 1500 }] }]),
});

function fakes(overrides: Partial<SendInvoiceEmailDeps> = {}, status = "DRAFT") {
  const calls = { sql: [] as string[], puts: [] as Array<{ key: string; body: Uint8Array; filename: string }>, emails: [] as any[], completions: [] as boolean[] };
  const deps: SendInvoiceEmailDeps = {
    async runSql(request) {
      calls.sql.push(request.statement.trim().split(/\s+/)[0]);
      expect(request.params.acc).toBe("ACC");
      if (request.statement.includes("INSERT INTO invoice_reminders")) return [{ reminderId: "R1" }];
      if (request.statement.includes("UPDATE invoice_reminders")) {
        calls.completions.push(request.params.sent as boolean);
        return [{ reminderId: "R1" }];
      }
      return request.statement.includes("UPDATE invoices") ? [{ invoiceId: "INV", status: "SENT" }] : [documentRow(status)];
    },
    async putPdf(key, body, filename) { calls.puts.push({ key, body, filename }); },
    async sendEmail(email) { calls.emails.push(email); },
    async getLinkSecret() { return SECRET; },
    sender: "Facturas <facturas@nexo.example>",
    downloadBaseUrl: "https://dl.example/",
    now: () => NOW,
    ...overrides,
  };
  return { deps, calls };
}

const event = { accountId: "ACC", actor: "u@x.com", invoiceId: "INV", to: "ap@cliente.example", message: "Gracias" };

test("renders, stores, links, emails and only then marks a draft as sent", async () => {
  const { deps, calls } = fakes();
  const result = await createSendInvoiceEmailHandler(deps)(event);

  expect(result).toEqual({ invoiceId: "INV", sentTo: "ap@cliente.example", linkExpiresAt: "2026-11-15T12:00:00.000Z", statusUpdated: true, warning: null });
  expect(calls.sql).toEqual(["SELECT", "UPDATE"]);
  expect(calls.puts[0].key).toBe(`accounts/ACC/invoices/INV/${NOW.getTime()}.pdf`);
  expect(calls.puts[0].filename).toBe("Factura-A-0050.pdf");
  expect((await PDFDocument.load(calls.puts[0].body)).getTitle()).toBe("Invoice A-0050");

  const email = calls.emails[0];
  expect(email).toMatchObject({ from: "Facturas <facturas@nexo.example>", to: "ap@cliente.example", replyTo: "billing@nexo.example", subject: "Factura A-0050 de Nexo Demo" });
  expect(email.html).toContain("Cliente &lt;b&gt;");
  const token = decodeURIComponent(email.text.match(/\?t=(\S+)/)[1]);
  expect(verifyInvoiceLinkToken(token, SECRET, NOW.getTime())).toMatchObject({ key: calls.puts[0].key, accountId: "ACC", invoiceId: "INV" });
});

test("does not touch the status of sent or paid invoices", async () => {
  const { deps, calls } = fakes({}, "PAID");
  const result = await createSendInvoiceEmailHandler(deps)(event);
  expect(result.statusUpdated).toBe(false);
  expect(calls.sql).toEqual(["SELECT"]);
});

test("a failed status update after the email went out returns a warning instead of failing", async () => {
  const { deps } = fakes();
  const runSql = deps.runSql;
  deps.runSql = async (request) => {
    if (request.statement.includes("UPDATE invoices")) throw new Error("db down");
    return runSql(request);
  };
  const result = await createSendInvoiceEmailHandler(deps)(event);
  expect(result).toMatchObject({ statusUpdated: false, warning: expect.stringMatching(/no se pudo marcar/) });
});

test("nothing is stored or sent when the email fails, and the draft stays a draft", async () => {
  const { deps, calls } = fakes({ async sendEmail() { throw new Error("SES rejected"); } });
  await expect(createSendInvoiceEmailHandler(deps)(event)).rejects.toThrow("SES rejected");
  expect(calls.sql).toEqual(["SELECT"]);
});

test("rejects missing configuration, bad recipients, long messages and unknown invoices before any side effect", async () => {
  const { deps, calls } = fakes();
  const send = createSendInvoiceEmailHandler(deps);
  await expect(createSendInvoiceEmailHandler({ ...deps, sender: undefined })(event)).rejects.toThrow(/no está configurado/);
  await expect(send({ ...event, to: "a@b.com, c@d.com" })).rejects.toThrow(/email de destino/);
  await expect(send({ ...event, message: "x".repeat(2001) })).rejects.toThrow(/2000/);
  const missing = fakes({ async runSql() { return []; } });
  await expect(createSendInvoiceEmailHandler(missing.deps)(event)).rejects.toThrow(/no encontrada/);
  expect(calls.puts).toHaveLength(0);
  expect(calls.emails).toHaveLength(0);
  expect(missing.calls.puts).toHaveLength(0);
});

test("the download link redirects to a short-lived S3 URL and rejects expired or forged tokens", async () => {
  const { deps, calls } = fakes();
  await createSendInvoiceEmailHandler(deps)(event);
  const token = decodeURIComponent(calls.emails[0].text.match(/\?t=(\S+)/)[1]);
  const presigned: Array<[string, string, number]> = [];
  const download = (now: number) => createDownloadInvoiceHandler({
    async getLinkSecret() { return SECRET; },
    async presignDownload(key, filename, ttl) { presigned.push([key, filename, ttl]); return "https://s3.example/signed"; },
    now: () => now,
  });
  const request = (t: string, method = "GET") => ({ queryStringParameters: { t }, requestContext: { http: { method } } }) as any;

  const ok = await download(NOW.getTime())(request(token));
  expect(ok).toMatchObject({ statusCode: 302, headers: { location: "https://s3.example/signed", "cache-control": "no-store" } });
  expect(presigned).toEqual([[`accounts/ACC/invoices/INV/${NOW.getTime()}.pdf`, "Factura-A-0050.pdf", 300]]);

  expect((await download(NOW.getTime() + 31 * 86_400_000)(request(token))).statusCode).toBe(410);
  expect((await download(NOW.getTime())(request(`${token}x`))).statusCode).toBe(410);
  expect((await download(NOW.getTime())(request(token, "POST"))).statusCode).toBe(405);
  expect(presigned).toHaveLength(1);
});

test("a manual reminder needs a sent invoice with a balance and is logged as sent", async () => {
  const { deps, calls } = fakes({}, "SENT");
  const result = await createSendInvoiceEmailHandler(deps)({ ...event, kind: "REMINDER" });
  expect(result).toMatchObject({ statusUpdated: false, warning: null });
  expect(calls.sql).toEqual(["SELECT", "INSERT", "UPDATE"]);
  expect(calls.completions).toEqual([true]);
  const email = calls.emails[0];
  expect(email.subject).toBe("Recordatorio de pago: factura A-0050 de Nexo Demo");
  expect(email.text).toContain("Saldo pendiente: $1,000.00.");
  expect(email.text).toContain("vence el 11/15/2026 (en 30 días)");
  expect(email.text).toContain("Si ya realizaste el pago");

  for (const status of ["DRAFT", "PAID"]) {
    const other = fakes({}, status);
    await expect(createSendInvoiceEmailHandler(other.deps)({ ...event, kind: "REMINDER" })).rejects.toThrow(/enviadas y no pagadas/);
    expect(other.calls.emails).toHaveLength(0);
  }
});

test("a manual reminder whose email fails is logged as failed and the error surfaces", async () => {
  const { deps, calls } = fakes({ async sendEmail() { throw new Error("SES rejected"); } }, "SENT");
  await expect(createSendInvoiceEmailHandler(deps)({ ...event, kind: "REMINDER" })).rejects.toThrow("SES rejected");
  expect(calls.completions).toEqual([false]);
});

test("no reminder is sent when nothing is owed", async () => {
  const { deps, calls } = fakes({}, "SENT");
  const runSql = deps.runSql;
  deps.runSql = async (request) => (await runSql(request)).map((row) => ({ ...row, balanceDue: "0.00" }));
  await expect(createSendInvoiceEmailHandler(deps)({ ...event, kind: "REMINDER" })).rejects.toThrow(/saldo pendiente/);
  expect(calls.emails).toHaveLength(0);
});

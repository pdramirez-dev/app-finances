import { expect, test } from "vitest";
import {
  buildInvoiceEmail, escapeHtml, invoicePdfFilename, invoicePdfKey, isValidRecipient, MAX_EMAIL_MESSAGE_LENGTH,
} from "./invoice-email";

const base = {
  issuerName: "Peña <Servicios>", invoiceLabel: "A-0050", billToName: "Cliente \"X\"", grandTotal: "$1,500.00",
  dueDate: "11/15/2026", link: "https://dl.example/?t=abc&x=1", linkExpiresAt: new Date(Date.UTC(2026, 10, 15)),
};

test("escapes every user-controlled value in the HTML body", () => {
  const email = buildInvoiceEmail({ ...base, message: "<script>alert(1)</script>\nGracias" });
  expect(email.html).not.toMatch(/<script>|<Servicios>/);
  expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(email.html).toContain("Cliente &quot;X&quot;");
  expect(email.html).toContain('href="https://dl.example/?t=abc&amp;x=1"');
  expect(email.text).toContain("Descárgala aquí: https://dl.example/?t=abc&x=1");
  expect(email.text).toContain("15 de noviembre de 2026");
});

test("caps the personal message and keeps the subject on one line", () => {
  const email = buildInvoiceEmail({ ...base, issuerName: "A\r\nBcc: x@y.z", message: "x".repeat(MAX_EMAIL_MESSAGE_LENGTH + 500) });
  expect(email.subject).toBe("Factura A-0050 de A Bcc: x@y.z");
  expect(email.text.match(/x+/g)?.some((run) => run.length === MAX_EMAIL_MESSAGE_LENGTH)).toBe(true);
  expect(email.text).not.toContain("x".repeat(MAX_EMAIL_MESSAGE_LENGTH + 1));
});

test("accepts one plain recipient address only", () => {
  expect(isValidRecipient("ap@cliente.example")).toBe(true);
  expect(isValidRecipient("a@b.co")).toBe(true);
  for (const bad of ["", "nope", "a@b", "a@b.c", "a@b.com, c@d.com", "Name <a@b.com>", "a@b.com\nBcc:c@d.com", 42]) {
    expect(isValidRecipient(bad), String(bad)).toBe(false);
  }
});

test("S3 keys stay under the tenant prefix and filenames are ASCII", () => {
  expect(invoicePdfKey("ACC", "INV", new Date(1_700_000_000_000))).toBe("accounts/ACC/invoices/INV/1700000000000.pdf");
  expect(invoicePdfFilename("A-0050")).toBe("Factura-A-0050.pdf");
  expect(invoicePdfFilename("1045")).toBe("Factura-1045.pdf");
  expect(invoicePdfFilename("Ñ/../x")).toBe("Factura-N-x.pdf");
  expect(escapeHtml("'&")).toBe("&#39;&amp;");
});

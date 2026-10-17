import { PDFDocument } from "pdf-lib";
import { expect, test } from "vitest";
import { renderInvoicePdf, toWinAnsi, type InvoicePdfData } from "./invoice-pdf";

const base: InvoicePdfData = {
  issuer: { name: "Peña & Hijos — Servicios", taxId: "US-1", address: "1 Calle Ñandú\nOrlando, FL", email: "hola@pena.example" },
  bank: { bankName: "Banco", accountNumberMasked: "•••• 1234" },
  invoice: {
    label: "A-0050", date: "2026-10-16", dueDate: "2026-11-15", weekNumber: 42,
    billToName: "Cliente Łódź 東京 🚀", billToAddress: "Dirección → larga", project: "Proyecto ñ",
    currency: "USD", notes: "Gracias • pago a 30 días", grandTotal: 1500,
    sections: [{ title: "Cuadrilla", total: 1500, lineItems: [{ description: "Mano de obra", quantity: 1.5, amount: 1000 }] }],
  },
};

test("toWinAnsi keeps Spanish text and replaces what standard PDF fonts cannot draw", () => {
  expect(toWinAnsi("Peña — Señal • €")).toBe("Peña — Señal • €");
  expect(toWinAnsi("Łódź")).toBe("Lódz");
  expect(toWinAnsi("東京 🚀 →")).toBe("?? ? ?");
  expect(toWinAnsi("a\tb\r\nc")).toBe("a b\nc");
});

test("renders a valid PDF even with characters outside Latin-1", async () => {
  const bytes = await renderInvoicePdf(base);
  expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  const parsed = await PDFDocument.load(bytes);
  expect(parsed.getPageCount()).toBe(1);
  expect(parsed.getTitle()).toBe("Invoice A-0050");
});

test("long invoices flow onto additional pages", async () => {
  const lineItems = Array.from({ length: 120 }, (_, index) => ({
    description: `Concepto ${index} con una descripción bastante larga que obliga a partir la línea en dos`,
    quantity: 1,
    amount: 10,
  }));
  const bytes = await renderInvoicePdf({
    ...base,
    invoice: { ...base.invoice, sections: [{ title: "Larga", total: 1200, lineItems }], grandTotal: 1200 },
  });
  expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
});

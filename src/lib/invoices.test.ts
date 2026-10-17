import { describe, expect, it } from "vitest";

import { formatInvoiceNumber } from "@/lib/invoices";

describe("formatInvoiceNumber", () => {
  it("keeps the general numbering as a plain number", () => {
    expect(formatInvoiceNumber({ seriesCode: "", invoiceNumber: 1045 })).toBe("1045");
    expect(formatInvoiceNumber({ seriesCode: null, invoiceNumber: 7 })).toBe("7");
  });

  it("prefixes series numbers with their code and pads to four digits without truncating", () => {
    expect(formatInvoiceNumber({ seriesCode: "A", invoiceNumber: 12 })).toBe("A-0012");
    expect(formatInvoiceNumber({ seriesCode: "R-2026", invoiceNumber: 12345 })).toBe("R-2026-12345");
  });
});

import { describe, expect, it } from "vitest";

import { formatInvoiceNumber, toLocalDateInputValue } from "@/lib/invoices";

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

describe("toLocalDateInputValue", () => {
  it("uses the local calendar day, not the UTC one", () => {
    // 9pm local on Oct 16 is already Oct 17 in UTC for timezones west of UTC.
    expect(toLocalDateInputValue(new Date(2026, 9, 16, 21, 30))).toBe("2026-10-16");
    expect(toLocalDateInputValue(new Date(2026, 0, 5, 0, 0))).toBe("2026-01-05");
  });
});

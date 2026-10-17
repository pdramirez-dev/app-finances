import type { InvoiceSectionInput } from "@/lib/validations";

export function calculateSectionTotal(section: InvoiceSectionInput) {
  return section.items.reduce((sum, item) => sum + item.quantity * item.amount, 0);
}

export function calculateGrandTotal(sections: InvoiceSectionInput[]) {
  return sections.reduce((sum, section) => sum + calculateSectionTotal(section), 0);
}

export function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoneyParts(amount: number, currency = "USD") {
  const parts = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(amount);

  const symbol = parts.find((part) => part.type === "currency")?.value ?? "$";
  const value = parts
    .filter((part) =>
      ["minusSign", "plusSign", "integer", "group", "decimal", "fraction"].includes(part.type),
    )
    .map((part) => part.value)
    .join("");

  return { symbol, value };
}

// For dates parsed from AWSDate strings (UTC midnight): keeps the stored day.
export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

// For "today"-style defaults: the calendar day in the viewer's own timezone.
export function toLocalDateInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Mirrors INVOICE_NUMBER_LABEL in the resolvers: the general numbering stays a
// plain number, series numbers are "CODE-0001" (padded, never truncated).
export function formatInvoiceNumber(invoice: { seriesCode?: string | null; invoiceNumber: number }) {
  return invoice.seriesCode
    ? `${invoice.seriesCode}-${String(invoice.invoiceNumber).padStart(4, "0")}`
    : String(invoice.invoiceNumber);
}

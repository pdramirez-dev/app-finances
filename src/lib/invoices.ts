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

export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

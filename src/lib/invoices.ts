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

export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

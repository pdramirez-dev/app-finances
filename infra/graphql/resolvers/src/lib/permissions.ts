export const ADMIN_ONLY_FIELDS = [
  "putAccount",
  "putBankAccount",
  "deleteClient",
  "deleteInvoice",
  "deleteInvoiceSection",
  "deleteInvoiceLineItem",
  "deleteContact",
  "deleteOpportunity",
  "deleteProject",
  "deleteTask",
  "deleteCalendarEvent",
  "registerPayment",
  "voidPayment",
  "putBankMovement",
  "reconcilePayment",
  "undoReconciliation",
] as const;

export function requiresAdminRole(fieldName: unknown): boolean {
  return typeof fieldName === "string" && (ADMIN_ONLY_FIELDS as readonly string[]).includes(fieldName);
}

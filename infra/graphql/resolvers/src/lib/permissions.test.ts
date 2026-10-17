import { expect, test } from "vitest";
import { requiresAdminRole } from "./permissions";

test.each([
  "putInvoiceSeries",
  "putReminderSettings",
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
])("%s requires an ADMIN or OWNER membership", (fieldName) => {
  expect(requiresAdminRole(fieldName)).toBe(true);
});

test("ordinary CRM writes remain available to active MEMBER memberships", () => {
  expect(requiresAdminRole("putContact")).toBe(false);
  expect(requiresAdminRole("putTask")).toBe(false);
  expect(requiresAdminRole(undefined)).toBe(false);
});

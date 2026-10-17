import { expect, test } from "vitest";
import { recordsToObjects } from "./aws-deps";

test("turns Data API records into objects keyed by column label", () => {
  expect(recordsToObjects([
    [{ stringValue: "INV" }, { longValue: 3 }, { stringValue: "1500.00" }, { booleanValue: true }, { isNull: true }],
  ], [{ label: "invoiceId", name: "id" }, { label: "version" }, { label: "grandTotal" }, { label: "remindersEnabled" }, { label: "notes" }]))
    .toEqual([{ invoiceId: "INV", version: 3, grandTotal: "1500.00", remindersEnabled: true, notes: null }]);
  expect(recordsToObjects(undefined, undefined)).toEqual([]);
});

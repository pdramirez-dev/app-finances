import { expect, test } from "vitest";
import { toSqlParameters } from "./aws-deps";

test("maps SQL builder params to Data API parameters with UUID hints for id columns", () => {
  expect(toSqlParameters({ acc: "A", invoiceId: "I", reminderId: "R", lim: 5, rate: 1.5, sent: true, error: null, today: "2026-02-17" }))
    .toEqual([
      { name: "acc", value: { stringValue: "A" }, typeHint: "UUID" },
      { name: "invoiceId", value: { stringValue: "I" }, typeHint: "UUID" },
      { name: "reminderId", value: { stringValue: "R" }, typeHint: "UUID" },
      { name: "lim", value: { longValue: 5 }, typeHint: undefined },
      { name: "rate", value: { doubleValue: 1.5 }, typeHint: undefined },
      { name: "sent", value: { booleanValue: true }, typeHint: undefined },
      { name: "error", value: { isNull: true }, typeHint: undefined },
      { name: "today", value: { stringValue: "2026-02-17" }, typeHint: undefined },
    ]);
});

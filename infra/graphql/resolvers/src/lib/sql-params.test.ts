import { expect, test } from "vitest";
import { sqlTypeHint, sqlVariables } from "./sql-params";

test("hints uuid and date parameters for the Data API and leaves the rest untyped", () => {
  expect(sqlVariables({ acc: "A", invoiceId: "I", date: "2026-10-16", status: "SENT", lim: 25, clientId: null })).toEqual({
    variableMap: { ":acc": "A", ":invoiceId": "I", ":date": "2026-10-16", ":status": "SENT", ":lim": 25, ":clientId": null },
    variableTypeHintMap: { ":acc": "UUID", ":invoiceId": "UUID", ":date": "DATE", ":clientId": "UUID" },
  });
});

test("unknown and prototype-like names never get a hint", () => {
  expect(sqlTypeHint("reference")).toBeUndefined();
  expect(sqlTypeHint("toString")).toBeUndefined();
  expect(sqlTypeHint("constructor")).toBeUndefined();
});

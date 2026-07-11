import { test, expect } from "vitest";
import { buildAuditItem } from "./audit";

const base = {
  accountId: "ACC_A", actor: "user@x.com", action: "DELETE", entityType: "CLIENT",
  entityId: "C1", data: { name: "X" }, now: "2026-06-25T10:00:00.000Z", uid: "abc123", ttlSeconds: 1900000000,
} as const;

test("partition key is accountId and sort key is timestamp#uid", () => {
  const it = buildAuditItem(base);
  expect(it.accountId).toBe("ACC_A");
  expect(it.sk).toBe("2026-06-25T10:00:00.000Z#abc123");
});

test("entityKey enables byEntity GSI lookups", () => {
  expect(buildAuditItem(base).entityKey).toBe("CLIENT#C1");
});

test("carries actor, action, at, ttl and serialized data", () => {
  const it = buildAuditItem(base);
  expect(it.actor).toBe("user@x.com");
  expect(it.action).toBe("DELETE");
  expect(it.at).toBe("2026-06-25T10:00:00.000Z");
  expect(it.ttl).toBe(1900000000);
  expect(it.data).toBe(JSON.stringify({ name: "X" }));
});

test("missing data serializes to null", () => {
  expect(buildAuditItem({ ...base, data: undefined }).data).toBeNull();
});

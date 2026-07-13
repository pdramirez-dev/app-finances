import { test, expect } from "vitest";
import { buildAuditItem, resolveAuditEntityId } from "./audit";

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

test("resolves camelCase IDs from RDS rows using audit metadata", () => {
  expect(resolveAuditEntityId({ opportunityId: "OP-1" }, {}, "opportunityId")).toBe("OP-1");
  expect(resolveAuditEntityId([{ paymentId: "PAY-1" }], {}, "paymentId")).toBe("PAY-1");
});

test("resolves delete IDs from direct args and put IDs from input", () => {
  expect(resolveAuditEntityId(true, { projectId: "PRJ-1" }, "projectId")).toBe("PRJ-1");
  expect(resolveAuditEntityId(null, { input: { taskId: "TSK-1" } }, "taskId")).toBe("TSK-1");
});

test("returns null when the configured ID is absent", () => {
  expect(resolveAuditEntityId({ contactId: "C-1" }, {}, "projectId")).toBeNull();
});

test("supports CRM audit entity types and actions", () => {
  const item = buildAuditItem({
    ...base,
    action: "RECONCILE",
    entityType: "PAYMENT",
    entityId: "PAY-1",
  });
  expect(item.entityKey).toBe("PAYMENT#PAY-1");
  expect(item.action).toBe("RECONCILE");

  const undone = buildAuditItem({
    ...base,
    action: "UNRECONCILE",
    entityType: "PAYMENT",
    entityId: "PAY-1",
  });
  expect(undone.action).toBe("UNRECONCILE");
});

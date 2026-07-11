export type AuditInput = {
  accountId: string;
  actor: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE";
  entityType: "ACCOUNT" | "CLIENT" | "BANK_ACCOUNT" | "INVOICE";
  entityId: string;
  data?: unknown;
  now: string;
  uid: string;
  ttlSeconds: number;
};

export type AuditItem = {
  accountId: string;
  sk: string;
  entityKey: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  data: string | null;
  at: string;
  ttl: number;
};

export function buildAuditItem(i: AuditInput): AuditItem {
  return {
    accountId: i.accountId,
    sk: `${i.now}#${i.uid}`,
    entityKey: `${i.entityType}#${i.entityId}`,
    actor: i.actor,
    action: i.action,
    entityType: i.entityType,
    entityId: i.entityId,
    data: i.data === undefined || i.data === null ? null : JSON.stringify(i.data),
    at: i.now,
    ttl: i.ttlSeconds,
  };
}

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "UPSERT"
  | "DELETE"
  | "STATUS_CHANGE"
  | "STAGE_CHANGE"
  | "COMPLETE"
  | "RECONCILE"
  | "UNRECONCILE"
  | "VOID";

export type AuditEntityType =
  | "ACCOUNT"
  | "CLIENT"
  | "BANK_ACCOUNT"
  | "INVOICE"
  | "CONTACT"
  | "OPPORTUNITY"
  | "PROJECT"
  | "TASK"
  | "CALENDAR_EVENT"
  | "PAYMENT"
  | "BANK_MOVEMENT";

export type AuditInput = {
  accountId: string;
  actor: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  data?: unknown;
  now: string;
  uid: string;
  ttlSeconds: number;
};

export type AuditMetadata = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityIdField?: string;
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

/**
 * Resolve an audited entity ID without coupling the audit function to every
 * domain type. AppSync RDS resolvers expose camelCase GraphQL rows, while
 * deletes commonly expose the ID only through resolver arguments.
 */
export function resolveAuditEntityId(
  result: unknown,
  args: Record<string, any> | undefined,
  entityIdField?: string,
): string | null {
  const row = Array.isArray(result) ? result[0] : result;
  const record = row && typeof row === "object" ? row as Record<string, unknown> : undefined;
  const input = args?.input && typeof args.input === "object"
    ? args.input as Record<string, unknown>
    : undefined;

  const fields = entityIdField
    ? [entityIdField]
    : [
        "id", "clientId", "bankAccountId", "invoiceId",
        "contactId", "opportunityId", "projectId", "taskId", "eventId",
        "paymentId", "movementId", "accountId",
      ];

  for (const field of fields) {
    const value = record?.[field] ?? args?.[field] ?? input?.[field];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return null;
}

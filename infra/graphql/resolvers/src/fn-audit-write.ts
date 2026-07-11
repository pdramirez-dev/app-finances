import { util } from "@aws-appsync/utils";
import * as ddb from "@aws-appsync/utils/dynamodb";
import { buildAuditItem } from "./lib/audit";

const TWO_YEARS_SECONDS = 63072000;

export function request(ctx: any) {
  const accountId = ctx.identity.claims["custom:accountId"];
  const actor = ctx.identity.claims.email ?? ctx.identity.sub;
  const meta = ctx.stash.audit; // { action, entityType }
  // entityId/data del resultado de la función RDS previa, con fallback a los args.
  const row = Array.isArray(ctx.prev?.result) ? ctx.prev.result[0] : ctx.prev?.result;
  const entityId =
    row?.id ?? ctx.args.invoiceId ?? ctx.args.clientId ?? ctx.args.bankAccountId ?? ctx.args.input?.id ?? "unknown";

  const item = buildAuditItem({
    accountId,
    actor,
    action: meta.action,
    entityType: meta.entityType,
    entityId,
    data: row ?? ctx.args,
    now: util.time.nowISO8601(),
    uid: util.autoId(),
    ttlSeconds: util.time.nowEpochSeconds() + TWO_YEARS_SECONDS,
  });

  return ddb.put({ key: { accountId: item.accountId, sk: item.sk }, item });
}

export function response(ctx: any) {
  // No alterar el resultado de la mutación: devolver lo que produjo la función RDS previa.
  return ctx.prev.result;
}

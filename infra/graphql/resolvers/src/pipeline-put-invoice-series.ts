export function request(ctx: any) {
  ctx.stash.audit = { action: "UPSERT", entityType: "INVOICE_SERIES", entityIdField: "seriesId" };
  return {};
}

export function response(ctx: any) {
  return ctx.prev.result;
}

export function request(ctx: any) {
  ctx.stash.audit = { action: "UPDATE", entityType: "INVOICE", entityIdField: "invoiceId" };
  return {};
}

export function response(ctx: any) {
  return ctx.prev.result;
}

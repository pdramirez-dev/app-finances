export function request(ctx: any) {
  ctx.stash.audit = { action: "REMIND", entityType: "INVOICE", entityIdField: "invoiceId" };
  return {};
}

export function response(ctx: any) {
  return ctx.prev.result;
}

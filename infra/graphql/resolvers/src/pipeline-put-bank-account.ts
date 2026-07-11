export function request(ctx: any) {
  ctx.stash.audit = { action: "UPDATE", entityType: "BANK_ACCOUNT" };
  return {};
}

export function response(ctx: any) {
  return ctx.prev.result;
}

export function request(ctx: any) {
  ctx.stash.audit = { action: "UPDATE", entityType: "ACCOUNT" };
  return {};
}

export function response(ctx: any) {
  return ctx.prev.result;
}

export function request(ctx: any) {
  ctx.stash.audit = { action: "STATUS_CHANGE", entityType: "INVOICE" };
  return {};
}

export function response(ctx: any) {
  return ctx.prev.result;
}

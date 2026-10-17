export function request(ctx: any) {
  ctx.stash.audit = { action: "DELETE", entityType: "CLIENT", entityIdField: "clientId" };
  return {};
}

export function response(ctx: any) {
  return ctx.prev.result;
}

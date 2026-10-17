export function request() {
  return {};
}

export function response(ctx: any) {
  return ctx.prev.result;
}

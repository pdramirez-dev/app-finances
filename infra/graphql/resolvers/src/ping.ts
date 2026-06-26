import { sqlPing } from "./lib/sql-builders";
export function request() {
  return { ping: sqlPing() };
}
export function response(ctx: any) {
  return ctx;
}

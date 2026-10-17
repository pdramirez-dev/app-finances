import { util } from "@aws-appsync/utils";

// The Lambda never trusts the client for tenant or actor: both come from the
// Cognito claims here, and only the invoice, recipient and message from args.
export function request(ctx: any) {
  const accountId = ctx.identity.claims["custom:accountId"];
  if (!accountId) util.unauthorized();
  const input = ctx.args.input ?? {};
  return {
    operation: "Invoke",
    payload: {
      accountId,
      actor: ctx.identity.claims.email ?? ctx.identity.sub,
      invoiceId: input.invoiceId,
      to: input.to,
      message: input.message ?? null,
    },
  };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return ctx.result;
}

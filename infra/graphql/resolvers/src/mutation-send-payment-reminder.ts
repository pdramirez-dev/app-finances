import { util } from "@aws-appsync/utils";

// Same send Lambda as sendInvoiceEmail, asking for the outstanding balance.
// Tenant and actor come from the Cognito claims, never from the arguments.
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
      kind: "REMINDER",
    },
  };
}

export function response(ctx: any) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return ctx.result;
}

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Invoke',
    payload: {
      invoiceId: ctx.args.invoiceId,
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  return {
    accepted: true,
    invoiceId: ctx.args.invoiceId,
    message: 'PDF job requested',
  };
}

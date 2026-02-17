import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    index: 'byInvoiceNumber',
    query: {
      expression: '#invoiceNumber = :invoiceNumber',
      expressionNames: { '#invoiceNumber': 'invoiceNumber' },
      expressionValues: util.dynamodb.toMapValues({ ':invoiceNumber': ctx.args.invoiceNumber }),
    },
    limit: 1,
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result?.items?.[0] ?? null;
}

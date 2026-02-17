import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    index: 'bySectionOrder',
    query: {
      expression: 'invoiceId = :invoiceId',
      expressionValues: util.dynamodb.toMapValues({
        ':invoiceId': ctx.source.invoiceId,
      }),
    },
    scanIndexForward: true,
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  return ctx.result?.items ?? [];
}

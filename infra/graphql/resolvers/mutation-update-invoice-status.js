import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ invoiceId: ctx.args.invoiceId }),
    condition: { expression: 'attribute_exists(invoiceId)' },
    update: {
      expression: 'SET #status = :status, #updatedAt = :updatedAt',
      expressionNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
      },
      expressionValues: util.dynamodb.toMapValues({
        ':status': ctx.args.status,
        ':updatedAt': util.time.nowISO8601(),
      }),
    },
    returnValues: 'ALL_NEW',
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  return ctx.result;
}

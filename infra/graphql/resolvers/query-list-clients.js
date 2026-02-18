import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const limit = ctx.args.limit ?? 25;

  return {
    operation: 'Query',
    index: 'byClientName',
    query: {
      expression: 'accountId = :accountId',
      expressionValues: util.dynamodb.toMapValues({
        ':accountId': ctx.args.accountId,
      }),
    },
    nextToken: ctx.args.nextToken,
    limit,
    scanIndexForward: true,
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  const result = ctx.result ?? {};
  return {
    items: result.items ?? [],
    nextToken: result.nextToken ?? null,
  };
}

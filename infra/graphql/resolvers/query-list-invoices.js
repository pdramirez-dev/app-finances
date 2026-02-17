import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const limit = ctx.args.limit ?? 25;

  if (ctx.args.status) {
    return {
      operation: 'Query',
      index: 'byStatusCreatedAt',
      query: {
        expression: '#status = :status',
        expressionNames: { '#status': 'status' },
        expressionValues: util.dynamodb.toMapValues({ ':status': ctx.args.status }),
      },
      nextToken: ctx.args.nextToken,
      limit,
      scanIndexForward: false,
    };
  }

  return {
    operation: 'Scan',
    nextToken: ctx.args.nextToken,
    limit,
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

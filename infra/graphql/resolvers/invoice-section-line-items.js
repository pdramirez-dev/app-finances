import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    index: 'byLineItemOrder',
    query: {
      expression: 'sectionId = :sectionId',
      expressionValues: util.dynamodb.toMapValues({
        ':sectionId': ctx.source.sectionId,
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

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const input = ctx.args.input;
  const lineItemId = input.lineItemId ?? util.autoId();

  const item = {
    sectionId: input.sectionId,
    lineItemId,
    description: input.description,
    quantity: input.quantity,
    amount: input.amount,
    position: input.position,
  };

  ctx.stash.item = item;

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ sectionId: input.sectionId, lineItemId }),
    attributeValues: util.dynamodb.toMapValues(item),
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  return ctx.stash.item;
}

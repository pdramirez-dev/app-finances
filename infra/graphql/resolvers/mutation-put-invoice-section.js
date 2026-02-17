import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const input = ctx.args.input;
  const sectionId = input.sectionId ?? util.autoId();

  const item = {
    invoiceId: input.invoiceId,
    sectionId,
    title: input.title,
    position: input.position,
    total: input.total,
  };

  ctx.stash.item = item;

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ invoiceId: input.invoiceId, sectionId }),
    attributeValues: util.dynamodb.toMapValues(item),
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  return ctx.stash.item;
}

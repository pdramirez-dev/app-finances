import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const input = ctx.args.input;
  const now = util.time.nowISO8601();
  const clientId = input.clientId ?? util.autoId();

  const item = {
    accountId: input.accountId,
    clientId,
    clientName: input.name,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    taxId: input.taxId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  ctx.stash.item = item;

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({
      accountId: input.accountId,
      clientId,
    }),
    attributeValues: util.dynamodb.toMapValues(item),
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.stash.item;
}

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const input = ctx.args.input;
  const now = util.time.nowISO8601();
  const accountId = input.accountId ?? util.autoId();

  const item = {
    accountId,
    type: input.type,
    displayName: input.displayName,
    legalName: input.legalName ?? null,
    taxId: input.taxId ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    createdAt: now,
    updatedAt: now,
  };

  ctx.stash.item = item;

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ accountId }),
    attributeValues: util.dynamodb.toMapValues(item),
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.stash.item;
}

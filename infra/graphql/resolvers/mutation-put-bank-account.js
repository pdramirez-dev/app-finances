import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const input = ctx.args.input;
  const now = util.time.nowISO8601();
  const bankAccountId = input.bankAccountId ?? 'primary';

  const item = {
    accountId: input.accountId,
    bankAccountId,
    beneficiaryName: input.beneficiaryName,
    bankName: input.bankName,
    accountNumberMasked: input.accountNumberMasked ?? null,
    routingNumberMasked: input.routingNumberMasked ?? null,
    ibanMasked: input.ibanMasked ?? null,
    swiftCode: input.swiftCode ?? null,
    currency: input.currency,
    country: input.country ?? null,
    createdAt: now,
    updatedAt: now,
  };

  ctx.stash.item = item;

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({
      accountId: input.accountId,
      bankAccountId,
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

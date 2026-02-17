import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const input = ctx.args.input;
  const now = util.time.nowISO8601();
  const invoiceId = input.invoiceId ?? util.autoId();

  const item = {
    invoiceId,
    invoiceNumber: input.invoiceNumber,
    date: input.date,
    weekNumber: input.weekNumber,
    billToName: input.billToName,
    billToAddress: input.billToAddress,
    project: input.project,
    currency: input.currency ?? 'USD',
    notes: input.notes ?? null,
    grandTotal: input.grandTotal,
    status: input.status ?? 'DRAFT',
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };

  ctx.stash.item = item;

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ invoiceId }),
    attributeValues: util.dynamodb.toMapValues(item),
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  return ctx.stash.item;
}

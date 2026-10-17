// The RDS Data API binds string parameters as varchar. PostgreSQL does not
// convert varchar to uuid or date implicitly, so `account_id = :acc` fails with
// "operator does not exist: uuid = character varying" unless the parameter
// carries a type hint. Enums and timestamps are cast in the SQL instead (there
// is no enum hint, and the TIMESTAMP hint rejects ISO strings).
//
// One map, keyed by parameter name, shared by the AppSync resolvers, the
// Lambdas and the integration tests, so a builder whose parameter is missing
// here fails in the Postgres tests. Plain object lookups only: this file is
// bundled into APPSYNC_JS resolvers.
export type SqlTypeHint = "UUID" | "DATE";

export const SQL_PARAM_TYPE_HINTS: Record<string, SqlTypeHint> = {
  acc: "UUID",
  id: "UUID",
  clientId: "UUID",
  invoiceId: "UUID",
  sectionId: "UUID",
  lineItemId: "UUID",
  seriesId: "UUID",
  bankAccountId: "UUID",
  contactId: "UUID",
  opportunityId: "UUID",
  projectId: "UUID",
  paymentId: "UUID",
  movementId: "UUID",
  reminderId: "UUID",
  date: "DATE",
  dueDate: "DATE",
  bookedOn: "DATE",
  valueOn: "DATE",
};

export function sqlTypeHint(name: string): SqlTypeHint | undefined {
  return Object.hasOwn(SQL_PARAM_TYPE_HINTS, name) ? SQL_PARAM_TYPE_HINTS[name] : undefined;
}

/** variableMap and variableTypeHintMap for an AppSync RDS resolver request. */
export function sqlVariables(params: Record<string, unknown>) {
  const variableMap: Record<string, unknown> = {};
  const variableTypeHintMap: Record<string, SqlTypeHint> = {};
  for (const [name, value] of Object.entries(params)) {
    variableMap[`:${name}`] = value;
    const hint = sqlTypeHint(name);
    if (hint) variableTypeHintMap[`:${name}`] = hint;
  }
  return { variableMap, variableTypeHintMap };
}

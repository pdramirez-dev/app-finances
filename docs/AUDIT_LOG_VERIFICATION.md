# Audit Log — Post-Deploy Verification (Foundation Plan 3)

The audit log records an append-only trace of sensitive actions in the
`app-finances-<stage>-audit-log` DynamoDB table. Each sensitive mutation is an
AppSync **pipeline resolver** of two functions: (1) the RDS function runs the
Postgres mutation (Plan 2), (2) `AuditWriteFn` writes the audit entry to
DynamoDB using the mutation result and the Cognito claims. Because the audit
write is the **second** function, if the RDS mutation fails the pipeline never
writes an audit entry (atomicity within the GraphQL operation).

Sensitive mutations wired as pipelines:

| Mutation | action | entityType |
|---|---|---|
| `putAccount` | `UPDATE` | `ACCOUNT` |
| `putBankAccount` | `UPDATE` | `BANK_ACCOUNT` |
| `deleteClient` | `DELETE` | `CLIENT` |
| `updateInvoiceStatus` | `STATUS_CHANGE` | `INVOICE` |

## Automated verification (CI)

Unit + integration + CDK suites, run from `infra/`:

```bash
cd infra && npm run build:resolvers && npx vitest run
# → 5 files, 48 tests passing (integration tests need Docker Postgres on :55432
#   via `docker compose -f docker-compose.test.yml up -d`)
```

Covered automatically:
- `buildAuditItem` shape (sk = `<iso>#<uid>`, entityKey = `<TYPE>#<id>`, TTL,
  serialized `data`, null-data) — `graphql/resolvers/src/lib/audit.test.ts`.
- `audit-log` table (PK `accountId` / SK `sk`, `byEntity` GSI, TTL) present in
  synth — `test/backend-stack.test.ts`.
- Cross-tenant isolation of the RDS mutations themselves — `test/isolation.int.test.ts`.

The DynamoDB `PutItem` path runs only in a deployed AppSync pipeline, so it is
verified manually below.

## Manual verification (post-deploy)

1. Deploy: `cd infra && npx cdk deploy AppFinances-Backend-dev`.
2. As a user of account **A**, run `updateInvoiceStatus` on an invoice you own.
3. Query the audit table and confirm an entry exists:
   ```bash
   aws dynamodb query \
     --table-name app-finances-dev-audit-log \
     --key-condition-expression "accountId = :a" \
     --expression-attribute-values '{":a":{"S":"<ACCOUNT_A_ID>"}}'
   ```
   Expect one item with `action=STATUS_CHANGE`, `entityType=INVOICE`,
   `actor=<your email or sub>`, `at` recent (ISO8601), `entityKey=INVOICE#<id>`,
   and a `ttl` ~2 years out.
4. Repeat for `putBankAccount` (`UPDATE`/`BANK_ACCOUNT`), `deleteClient`
   (`DELETE`/`CLIENT`), and `putAccount` (`UPDATE`/`ACCOUNT`).
5. Negative check (atomicity): trigger a mutation that fails the RDS step (e.g.
   `updateInvoiceStatus` on an invoice from another account, which the Plan 2
   builder scopes out) and confirm **no** audit entry was written for it.

## Notes / known limitations

- MVP audits the resulting (`after`) state + action. Capturing the previous
  value would require an extra read — deferred. For `deleteClient` the RDS
  function returns `true`, so its audit entry carries `entityKey=CLIENT#<id>`
  and action but no row snapshot.
- `accountId` and `actor` always come from Cognito claims, never client input.
- **Audit-write happens after the RDS mutation commits.** If the Postgres write
  succeeds but the DynamoDB `PutItem` then fails, the client receives an error
  even though the domain change is already persisted (and not rolled back), and
  no audit row is written. This is the trade-off of the "audit-second" ordering
  (which guarantees no orphan audit entries for failed mutations); a missing
  audit row for a committed change must be detected operationally, not via the
  GraphQL response.

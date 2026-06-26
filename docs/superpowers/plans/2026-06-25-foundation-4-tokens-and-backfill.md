# Foundation Plan 4 — Tokens NextAuth + backfill del piloto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los huecos de auth (tokens de Cognito fuera del objeto `session`, refresh automático del `idToken`, quitar el modo IAM de AppSync) y migrar los datos del cliente piloto de DynamoDB a Postgres con verificación.

**Architecture:** Los tokens de Cognito viven solo en el JWT cifrado (server-side); el `session` callback deja de exponerlos y el código server los lee con `getToken`. El `jwt` callback guarda `refreshToken` + expiración y renueva el `idToken` cuando está por vencer vía `REFRESH_TOKEN_AUTH`. La lógica de decisión de refresh se extrae a funciones puras testeables. El backfill es un script idempotente que exporta DynamoDB e inserta en Postgres vía Data API, sembrando contadores y verificando totales.

**Tech Stack:** TypeScript, NextAuth v5 (`next-auth/jwt`), Cognito (`REFRESH_TOKEN_AUTH`), AWS CDK, `@aws-sdk/client-rds-data`, `@aws-sdk/client-dynamodb`, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-25-multi-tenant-foundation-design.md`
**Depende de:** Plan 1 (esquema/Aurora), Plan 2 (resolvers Postgres).

---

## File Structure

- `src/lib/token-refresh.ts` — lógica pura: decisión de refresh y merge del token renovado.
- `src/lib/token-refresh.test.ts` — unit tests.
- `src/lib/cognito-auth.ts` — añadir `refreshToken` al resultado y `refreshCognitoTokens()`.
- `src/lib/auth-flow-tickets.ts` — propagar `refreshToken` en el auth ticket.
- `src/app/api/cognito/login/route.ts` — incluir `refreshToken` en el ticket.
- `src/auth.ts` — `jwt` callback con refresh; `session` callback sin tokens.
- `src/lib/cognito-session.ts` — accesor server-only del `idToken`.
- `src/lib/appsync/invoices.ts` — leer el `idToken` del accesor server-only.
- `infra/lib/stacks/backend-stack.ts` — quitar `additionalAuthorizationModes: [IAM]`.
- `infra/scripts/backfill-pilot.ts` — export DynamoDB → insert Postgres + verificación.

---

## Task 1: Propagar refreshToken (Cognito → ticket → login)

**Files:**
- Modify: `src/lib/cognito-auth.ts`, `src/lib/auth-flow-tickets.ts`, `src/app/api/cognito/login/route.ts`
- Test: `src/lib/auth-flow-tickets.test.ts`

- [ ] **Step 1: Test que falla — el ticket round-trip conserva refreshToken**

`src/lib/auth-flow-tickets.test.ts`:
```ts
import { test, expect, beforeAll } from "vitest";
import { createAuthTicket, readAuthTicket } from "./auth-flow-tickets";

beforeAll(() => { process.env.AUTH_SECRET = "test-secret-please-change"; });

test("auth ticket carries the refresh token", () => {
  const ticket = createAuthTicket({
    user: { id: "u1", email: "u@x.com", name: "U" },
    accessToken: "AAA", idToken: "III", refreshToken: "RRR",
  });
  const payload = readAuthTicket(ticket);
  expect(payload?.refreshToken).toBe("RRR");
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/auth-flow-tickets.test.ts`
Expected: FAIL — `refreshToken` no es parte del payload.

- [ ] **Step 3: Añadir `refreshToken` al tipo del ticket**

En `src/lib/auth-flow-tickets.ts`, `AuthTicketPayload`:
```ts
export type AuthTicketPayload = BaseTicket<"auth"> & {
  user: { id: string; email: string; name: string };
  accessToken: string;
  idToken: string;
  refreshToken: string;
};
```

- [ ] **Step 4: Añadir `refreshToken` al resultado de Cognito**

En `src/lib/cognito-auth.ts`:
- `CognitoSuccessResult` += `refreshToken: string;`
- En `normalizeAuthResult`, leer `payload.AuthenticationResult?.RefreshToken` y devolverlo (puede faltar en respuestas de challenge intermedias; usar `?? ""`).
- Tipar `RefreshToken?: string` en los genéricos de `AuthenticationResult`.

- [ ] **Step 5: Incluir refreshToken en el login route**

En `src/app/api/cognito/login/route.ts`, al crear el `createAuthTicket`:
```ts
authTicket: createAuthTicket({
  user: result.user,
  accessToken: result.accessToken,
  idToken: result.idToken,
  refreshToken: result.refreshToken,
}),
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npx vitest run src/lib/auth-flow-tickets.test.ts && npx tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cognito-auth.ts src/lib/auth-flow-tickets.ts src/lib/auth-flow-tickets.test.ts src/app/api/cognito/login/route.ts
git commit -m "feat(auth): carry Cognito refresh token through the auth ticket"
```

---

## Task 2: Función de refresh en Cognito

**Files:**
- Modify: `src/lib/cognito-auth.ts`
- Test: `src/lib/cognito-auth.test.ts`

- [ ] **Step 1: Test que falla — el payload de refresh es correcto**

`src/lib/cognito-auth.test.ts`:
```ts
import { test, expect } from "vitest";
import { buildRefreshPayload } from "./cognito-auth";

test("refresh payload uses REFRESH_TOKEN_AUTH and the refresh token", () => {
  const p = buildRefreshPayload("CLIENT123", "REFRESH_TOK", null);
  expect(p.AuthFlow).toBe("REFRESH_TOKEN_AUTH");
  expect(p.ClientId).toBe("CLIENT123");
  expect(p.AuthParameters.REFRESH_TOKEN).toBe("REFRESH_TOK");
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/cognito-auth.test.ts`
Expected: FAIL — `buildRefreshPayload` no existe.

- [ ] **Step 3: Implementar el builder puro + la llamada**

En `src/lib/cognito-auth.ts`:
```ts
export function buildRefreshPayload(clientId: string, refreshToken: string, secretHash: string | null) {
  const AuthParameters: Record<string, string> = { REFRESH_TOKEN: refreshToken };
  if (secretHash) AuthParameters.SECRET_HASH = secretHash;
  return { AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: clientId, AuthParameters };
}

export async function refreshCognitoTokens(refreshToken: string) {
  const clientId = resolveCognitoClientId();
  const payload = await callCognito<{
    AuthenticationResult?: { AccessToken?: string; IdToken?: string; ExpiresIn?: number };
  }>("InitiateAuth", buildRefreshPayload(clientId, refreshToken, null));
  const idToken = payload.AuthenticationResult?.IdToken;
  const accessToken = payload.AuthenticationResult?.AccessToken;
  if (!idToken || !accessToken) {
    throw new CognitoApiError("Refresh returned an incomplete result.", "IncompleteRefresh");
  }
  return { idToken, accessToken, expiresIn: payload.AuthenticationResult?.ExpiresIn ?? 3600 };
}
```
(Si el app client tuviera secret, calcular `SECRET_HASH` con el `sub` como username; para el cliente web actual `generateSecret: false`, así que `null`.)

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run src/lib/cognito-auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cognito-auth.ts src/lib/cognito-auth.test.ts
git commit -m "feat(auth): add Cognito REFRESH_TOKEN_AUTH refresh helper"
```

---

## Task 3: Lógica pura de refresh (decisión + merge) (TDD)

**Files:**
- Create: `src/lib/token-refresh.ts`
- Test: `src/lib/token-refresh.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

`src/lib/token-refresh.test.ts`:
```ts
import { test, expect } from "vitest";
import { isExpiringSoon, applyRefreshedTokens } from "./token-refresh";

test("isExpiringSoon true within skew window", () => {
  const now = 1_000_000;
  expect(isExpiringSoon(now + 30_000, now, 60_000)).toBe(true);   // expira en 30s, skew 60s
  expect(isExpiringSoon(now + 120_000, now, 60_000)).toBe(false); // expira en 120s
});

test("applyRefreshedTokens updates idToken/accessToken/expiry", () => {
  const token = { idToken: "old", accessToken: "oldA", idTokenExpiresAt: 1 } as any;
  const merged = applyRefreshedTokens(token, { idToken: "new", accessToken: "newA", expiresIn: 3600 }, 1_000_000);
  expect(merged.idToken).toBe("new");
  expect(merged.accessToken).toBe("newA");
  expect(merged.idTokenExpiresAt).toBe(1_000_000 + 3600 * 1000);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/token-refresh.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `token-refresh.ts`**

```ts
export type AuthToken = {
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  idTokenExpiresAt?: number; // epoch ms
  error?: string;
};

export function isExpiringSoon(expiresAt: number | undefined, now: number, skewMs: number): boolean {
  if (!expiresAt) return true;
  return expiresAt - now <= skewMs;
}

export function applyRefreshedTokens(
  token: AuthToken,
  refreshed: { idToken: string; accessToken: string; expiresIn: number },
  now: number,
): AuthToken {
  return {
    ...token,
    idToken: refreshed.idToken,
    accessToken: refreshed.accessToken,
    idTokenExpiresAt: now + refreshed.expiresIn * 1000,
    error: undefined,
  };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run src/lib/token-refresh.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/token-refresh.ts src/lib/token-refresh.test.ts
git commit -m "feat(auth): pure token refresh decision and merge helpers"
```

---

## Task 4: Cablear refresh y sacar tokens de la sesión

**Files:**
- Modify: `src/auth.ts`
- Create: `src/lib/cognito-session.ts`
- Modify: `src/lib/appsync/invoices.ts`, `src/types/next-auth.d.ts`

- [ ] **Step 1: `jwt` callback con expiración + refresh**

En `src/auth.ts`, callback `jwt`:
```ts
async jwt({ token, user }) {
  if (user) {
    token.id = String(user.id);
    token.accessToken = (user as any).accessToken;
    token.idToken = (user as any).idToken;
    token.refreshToken = (user as any).refreshToken;
    token.idTokenExpiresAt = Date.now() + 60 * 60 * 1000; // idToken Cognito = 60 min
    return token;
  }
  if (!isExpiringSoon((token as any).idTokenExpiresAt, Date.now(), 5 * 60 * 1000)) {
    return token;
  }
  try {
    const refreshed = await refreshCognitoTokens((token as any).refreshToken);
    return applyRefreshedTokens(token as any, refreshed, Date.now());
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}
```
(Importar `isExpiringSoon`, `applyRefreshedTokens`, `refreshCognitoTokens`. La `authorize` debe devolver `refreshToken` desde el ticket — ajustar el objeto retornado en `src/auth.ts` providers para incluir `refreshToken: ticket.refreshToken`.)

- [ ] **Step 2: `session` callback SIN tokens (solo lo no sensible)**

```ts
session({ session, token }) {
  if (session.user) {
    session.user.id = String(token.id ?? token.sub ?? "");
  }
  (session as any).error = (token as any).error;
  return session;
}
```
Quitar `session.accessToken`/`session.idToken`. Actualizar `src/types/next-auth.d.ts` para eliminar esos campos del `Session` y, si se quiere, exponer `error`.

- [ ] **Step 3: Accesor server-only del idToken**

`src/lib/cognito-session.ts`:
```ts
import "server-only";
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import { resolveAuthSecret } from "@/lib/auth-secret";

export async function getServerIdToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const req = { headers: { cookie: cookieStore.toString() } } as any;
  const token = await getToken({ req, secret: resolveAuthSecret() });
  const idToken = (token as any)?.idToken;
  return typeof idToken === "string" ? idToken : null;
}
```

- [ ] **Step 4: `appsyncRequest` usa el accesor server-only**

En `src/lib/appsync/invoices.ts`, reemplazar:
```ts
const session = await auth();
const idToken = session?.idToken;
```
por:
```ts
const idToken = await getServerIdToken();
```
e importar `getServerIdToken`. Quitar el import de `auth` si queda sin uso.

- [ ] **Step 5: Typecheck/lint y build**

Run: `npm run lint && npx tsc --noEmit && npm run build`
Expected: sin errores; el bundle de cliente ya no incluye los tokens en la sesión.

- [ ] **Step 6: Commit**

```bash
git add src/auth.ts src/lib/cognito-session.ts src/lib/appsync/invoices.ts src/types/next-auth.d.ts
git commit -m "feat(auth): refresh idToken and keep Cognito tokens out of the client session"
```

---

## Task 5: Quitar el modo de auth IAM de AppSync (TDD)

**Files:**
- Modify: `infra/lib/stacks/backend-stack.ts`
- Test: `infra/test/backend-stack.test.ts`

- [ ] **Step 1: Test que falla — solo auth User Pool**

Agregar a `infra/test/backend-stack.test.ts`:
```ts
test("AppSync API has no additional IAM authorization mode", () => {
  const t = synth();
  const apis = t.findResources("AWS::AppSync::GraphQLApi");
  const api = Object.values(apis)[0] as any;
  expect(api.Properties.AdditionalAuthenticationProviders ?? []).toHaveLength(0);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd infra && npx vitest run test/backend-stack.test.ts`
Expected: FAIL — hoy hay un provider IAM adicional.

- [ ] **Step 3: Quitar el modo IAM**

En `backend-stack.ts`, en `authorizationConfig` borrar:
```ts
additionalAuthorizationModes: [{ authorizationType: appsync.AuthorizationType.IAM }],
```
> Verificar que nada dependa de IAM (los resolvers RDS/Dynamo usan el rol del data source, no el modo de auth de la API; el frontend usa el idToken/User Pool).

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd infra && npx vitest run test/backend-stack.test.ts && npx cdk synth AppFinances-Backend-dev > /dev/null && echo OK`
Expected: PASS y `OK`.

- [ ] **Step 5: Commit**

```bash
git add infra/lib/stacks/backend-stack.ts infra/test/backend-stack.test.ts
git commit -m "chore(infra): drop unused IAM authorization mode from AppSync"
```

---

## Task 6: Backfill del piloto (DynamoDB → Postgres)

**Files:**
- Create: `infra/scripts/backfill-pilot.ts`
- Modify: `infra/package.json`

- [ ] **Step 1: Instalar el cliente DynamoDB**

Run: `cd infra && npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb`

- [ ] **Step 2: Escribir el script de backfill**

`infra/scripts/backfill-pilot.ts`:
```ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { RDSDataClient, ExecuteStatementCommand } from "@aws-sdk/client-rds-data";

const { DB_CLUSTER_ARN, DB_SECRET_ARN, DB_NAME = "app_finances",
  PILOT_ACCOUNT_ID, STAGE = "dev" } = process.env;
if (!DB_CLUSTER_ARN || !DB_SECRET_ARN || !PILOT_ACCOUNT_ID) {
  throw new Error("DB_CLUSTER_ARN, DB_SECRET_ARN and PILOT_ACCOUNT_ID are required");
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const rds = new RDSDataClient({});

async function scanAll(table: string): Promise<any[]> {
  const items: any[] = [];
  let ExclusiveStartKey: any;
  do {
    const out = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey }));
    items.push(...(out.Items ?? []));
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function exec(sql: string, parameters: any[]) {
  return rds.send(new ExecuteStatementCommand({
    resourceArn: DB_CLUSTER_ARN, secretArn: DB_SECRET_ARN, database: DB_NAME, sql, parameters,
  }));
}
const p = (name: string, value: any) =>
  value === null || value === undefined
    ? { name, value: { isNull: true } }
    : typeof value === "number"
      ? { name, value: Number.isInteger(value) ? { longValue: value } : { doubleValue: value } }
      : { name, value: { stringValue: String(value) } };

async function main() {
  const prefix = `app-finances-${STAGE}`;
  const invoices = await scanAll(`${prefix}-invoices`);
  const sections = await scanAll(`${prefix}-invoice-sections`);
  const lineItems = await scanAll(`${prefix}-invoice-line-items`);

  for (const inv of invoices) {
    await exec(
      `INSERT INTO invoices (id, account_id, invoice_number, date, week_number, bill_to_name,
         bill_to_address, project, currency, notes, grand_total, status, created_at, updated_at)
       VALUES (:id::uuid, :acc::uuid, :num, :date::date, :week, :bn, :ba, :proj, :cur, :notes, :gt, :st::invoice_status,
         COALESCE(:created::timestamptz, now()), now())
       ON CONFLICT (id) DO NOTHING`,
      [p("id", inv.invoiceId), p("acc", PILOT_ACCOUNT_ID), p("num", inv.invoiceNumber), p("date", inv.date),
       p("week", inv.weekNumber), p("bn", inv.billToName), p("ba", inv.billToAddress), p("proj", inv.project),
       p("cur", inv.currency ?? "USD"), p("notes", inv.notes ?? null), p("gt", inv.grandTotal),
       p("st", inv.status ?? "DRAFT"), p("created", inv.createdAt ?? null)],
    );
  }
  for (const s of sections) {
    await exec(
      `INSERT INTO invoice_sections (id, invoice_id, title, position, total)
       VALUES (:id::uuid, :inv::uuid, :title, :pos, :total) ON CONFLICT (id) DO NOTHING`,
      [p("id", s.sectionId), p("inv", s.invoiceId), p("title", s.title), p("pos", s.position), p("total", s.total)],
    );
  }
  for (const li of lineItems) {
    await exec(
      `INSERT INTO invoice_line_items (id, section_id, description, quantity, amount, position)
       VALUES (:id::uuid, :sec::uuid, :desc, :qty, :amt, :pos) ON CONFLICT (id) DO NOTHING`,
      [p("id", li.lineItemId), p("sec", li.sectionId), p("desc", li.description), p("qty", li.quantity),
       p("amt", li.amount), p("pos", li.position)],
    );
  }

  // Sembrar el contador con el máximo número del piloto.
  await exec(
    `INSERT INTO invoice_counters (account_id, last_invoice_number)
     SELECT :acc::uuid, COALESCE(MAX(invoice_number), 0) FROM invoices WHERE account_id = :acc::uuid
     ON CONFLICT (account_id) DO UPDATE SET last_invoice_number = EXCLUDED.last_invoice_number`,
    [p("acc", PILOT_ACCOUNT_ID)],
  );

  // Verificación: conteos coinciden.
  const count = await exec(`SELECT count(*)::int AS c FROM invoices WHERE account_id = :acc::uuid`, [p("acc", PILOT_ACCOUNT_ID)]);
  const pgCount = (count.records?.[0]?.[0] as any)?.longValue ?? 0;
  console.log(`DynamoDB invoices: ${invoices.length} | Postgres invoices: ${pgCount}`);
  if (pgCount !== invoices.length) throw new Error("Backfill mismatch: invoice counts differ");
  console.log("backfill verified OK");
}

main();
```

- [ ] **Step 3: Añadir script en package.json**

`"backfill:pilot": "tsx scripts/backfill-pilot.ts"`

- [ ] **Step 4: Typecheck**

Run: `cd infra && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add infra/scripts/backfill-pilot.ts infra/package.json infra/package-lock.json
git commit -m "feat(infra): backfill pilot data from DynamoDB to Postgres with verification"
```

> Procedimiento de cutover (notas de despliegue): `cdk deploy` → `db:migrate:aurora` → setear `custom:accountId` en el usuario piloto → `backfill:pilot` (con `PILOT_ACCOUNT_ID`) → smoke test de `listInvoices`/`getInvoice` → retirar tablas DynamoDB de dominio (Plan 2, Task 10).

---

## Self-Review (completado por el autor del plan)

- **Cobertura del spec:** tokens fuera de `session` ✓; refresh del idToken ✓; quitar IAM de AppSync ✓; backfill del piloto + sembrar contador + verificación de conteos ✓.
- **Sin placeholders:** builders, callbacks, accesor y script con código concreto y comandos con salida esperada.
- **Consistencia de tipos:** `AuthToken` y `applyRefreshedTokens` se usan igual en `token-refresh` y `auth.ts`; `refreshCognitoTokens` devuelve `{idToken, accessToken, expiresIn}` consumido por `applyRefreshedTokens`; `refreshToken` fluye Cognito → ticket → `authorize` → `jwt`.
- **Orden seguro:** el backfill corre antes de retirar DynamoDB (Plan 2 Task 10); las tablas `prod` tienen `RETAIN`.

## Riesgos / notas

- **`getToken` en App Router:** el accesor arma un `req` mínimo desde `cookies()`. Si la versión de NextAuth usa cookie partida/chunked, validar que `getToken` la reconstruye; alternativa: `auth()` con un campo server-only. Validar en `npm run build` + smoke test.
- **Tipos del Data API:** el helper `p()` mapea string/number/null; revisar fechas (`::date`/`::timestamptz`) y `numeric` (van como string para no perder precisión — ajustar a `stringValue` si hiciera falta).
- **Refresh fallido:** marca `token.error = "RefreshAccessTokenError"`; el frontend debe forzar re-login al ver `session.error` (mejora de UX, fuera de esta fundación).

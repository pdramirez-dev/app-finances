# Diseño: Fundación multi-tenant segura (Postgres + AppSync + Audit Log)

- **Fecha:** 2026-06-25
- **Estado:** Aprobado (pendiente de revisión final del usuario)
- **Autor:** Pablo Díaz (con asistencia de Claude)
- **Sub-proyecto:** #1 de 2 — la fundación. El sub-proyecto #2 (Proyectos + pipeline) se diseña en su propio spec sobre esta base.
- **Deadline del MVP:** 31 de julio de 2026

## Contexto

`app-finances` es una app de facturación (Next.js + NextAuth/Cognito + AppSync + DynamoDB + S3) que se quiere
evolucionar hacia una herramienta de gestión de proyectos para venderla como producto SaaS multi-empresa.

La revisión de código encontró un fallo de seguridad sistémico: **el aislamiento multi-tenant está roto**.
Los resolvers confían en un `accountId` enviado por el cliente y los invoices no tienen `accountId` (con `Scan`
de tabla completa). Cualquier usuario autenticado puede leer/modificar/borrar datos de cualquier otra cuenta (IDOR).

Como el producto se va a vender a múltiples empresas, el aislamiento deja de ser opcional. Se eligió el
**Enfoque B: endurecer la base antes de construir la feature de proyectos.**

## Objetivos

- `accountId` derivado **siempre del token**, nunca de input del cliente.
- Aislamiento por tenant en todas las entidades de dominio.
- Migrar la persistencia del dominio a **Postgres relacional** (mejor encaje con el dominio y el reporting del pipeline).
- Eliminar el `Scan` de `listInvoices` y la numeración de invoices con race conditions.
- Cerrar la fuga de tokens de Cognito al navegador y añadir refresh.
- Trazabilidad mediante un **audit log** para acciones sensibles.
- Base de pruebas (Vitest) con tests de aislamiento por tenant.

## No-objetivos (fuera de este spec)

- Feature de Proyectos / Fases / pipeline (sub-proyecto #2).
- Roles dentro de una cuenta (OWNER/ADMIN/MEMBER) — por ahora todo usuario tiene acceso pleno a su cuenta.
- Multi-cuenta por usuario (modelo 1 usuario = 1 cuenta).
- Integración con QuickBooks.
- Row-Level Security de Postgres (endurecimiento opcional futuro).
- Cifrado KMS de datos bancarios (hoy solo se guardan valores enmascarados).

## Decisiones de arquitectura

1. **Modelo de cuenta:** 1 usuario = 1 cuenta. Atributo `custom:accountId` (string, inmutable) en el User Pool de
   Cognito, legible por el app client → viaja en el `idToken`. El backend lo lee de `ctx.identity.claims` e ignora
   cualquier `accountId` del cliente.
2. **Motor de dominio:** Aurora Serverless v2 (PostgreSQL) con **RDS Data API** (HTTPS, sin pools de conexión;
   sin plomería de VPC para AppSync).
3. **Capa de API:** se **mantiene AppSync (GraphQL + auth Cognito)**. Los resolvers pasan de data source DynamoDB a
   **RDS data source** ejecutando SQL parametrizado vía Data API.
4. **Audit log:** se **conserva DynamoDB** solo para una tabla append-only de auditoría (persistencia poliglota).
5. Tres motores con roles claros: **Cognito** (identidad) · **Postgres** (dominio) · **DynamoDB** (audit log).
6. **Lenguaje del backend:** los datos/CRUD viven en **resolvers JS de AppSync + Data API** (no requieren Python).
   **Python se reserva para Lambdas de I/O con archivos físicos** (generación de PDF, ingesta de PO desde PDF,
   import/export, adjuntos). División: *AppSync+Data API mueve datos; Lambdas Python mueven archivos.*

## Modelo de datos (Postgres)

Convenciones: toda tabla de dominio lleva `account_id` (su valor = `custom:accountId`); PKs `uuid`; timestamps
`timestamptz`; **dinero en `numeric(14,2)`** (corrige el uso de `Float` del schema actual).

```sql
CREATE TYPE account_type   AS ENUM ('SELF_EMPLOYED', 'COMPANY');
CREATE TYPE invoice_status AS ENUM ('DRAFT', 'SENT', 'PAID');

CREATE TABLE accounts (
  id           uuid PRIMARY KEY,           -- == custom:accountId del claim
  type         account_type NOT NULL,
  display_name text NOT NULL,
  legal_name   text, tax_id text, email text, phone text, address text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  name       text NOT NULL,
  email      text, phone text, address text, tax_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clients_by_account_name ON clients (account_id, lower(name));

CREATE TABLE bank_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES accounts(id),
  beneficiary_name      text NOT NULL,
  bank_name             text NOT NULL,
  account_number_masked text, routing_number_masked text,
  iban_masked           text, swift_code text,
  currency              text NOT NULL,
  country               text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_accounts_by_account ON bank_accounts (account_id);

CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id),
  client_id       uuid REFERENCES clients(id),     -- enlace futuro a cliente
  invoice_number  int  NOT NULL,
  date            date NOT NULL,
  week_number     int  NOT NULL,
  bill_to_name    text NOT NULL,
  bill_to_address text NOT NULL,
  project         text NOT NULL,
  currency        text NOT NULL DEFAULT 'USD',
  notes           text,
  grand_total     numeric(14,2) NOT NULL,
  status          invoice_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, invoice_number)             -- número único POR cuenta
);
CREATE INDEX invoices_by_account_created ON invoices (account_id, created_at DESC);
CREATE INDEX invoices_by_account_status  ON invoices (account_id, status, created_at DESC);

CREATE TABLE invoice_sections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  title      text NOT NULL,
  position   int  NOT NULL,
  total      numeric(14,2) NOT NULL
);
CREATE INDEX sections_by_invoice ON invoice_sections (invoice_id, position);

CREATE TABLE invoice_line_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES invoice_sections(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    numeric(14,2) NOT NULL,
  amount      numeric(14,2) NOT NULL,
  position    int NOT NULL
);
CREATE INDEX line_items_by_section ON invoice_line_items (section_id, position);

CREATE TABLE invoice_counters (
  account_id          uuid PRIMARY KEY REFERENCES accounts(id),
  last_invoice_number int NOT NULL DEFAULT 0
);
```

Mejoras que el modelo relacional habilita:

- **Borrado en cascada:** borrar un invoice elimina secciones y líneas vía FK.
- **Numeración atómica por cuenta:** dentro de una transacción,
  `UPDATE invoice_counters SET last_invoice_number = last_invoice_number + 1 WHERE account_id = :acc RETURNING last_invoice_number;`
  y se usa ese valor en el `INSERT`. Sin races, sin traer 100 filas.

Las tablas de **Proyectos y Fases** se diseñan en el spec #2; el esquema está listo para colgarlas (FK a `accounts`,
`clients` y `invoices`).

## Patrón de autorización en resolvers

Cada resolver, antes de cualquier consulta:

```js
const accountId = ctx.identity.claims['custom:accountId'];
if (!accountId) util.unauthorized();
```

Y `accountId` siempre va en `WHERE`/`INSERT`, nunca del cliente. Ejemplos:

| Operación | SQL (vía Data API) |
| --- | --- |
| `listInvoices` | `SELECT … FROM invoices WHERE account_id = :acc [AND status = :st] ORDER BY created_at DESC LIMIT :lim` |
| `getInvoice` | `SELECT … WHERE id = :id AND account_id = :acc` → sin fila ⇒ `null` |
| `putInvoice` (crear) | transacción: `UPDATE invoice_counters … RETURNING` → `INSERT INTO invoices(account_id, invoice_number, …)` |
| `deleteInvoice` | `DELETE FROM invoices WHERE id = :id AND account_id = :acc` (cascada) |
| `listClients`/`getClient`/`putClient`/`deleteClient` | todas con `account_id = :acc` |
| `getBankAccount`/`putBankAccount` | idem |

### Cambios de schema GraphQL

Se eliminan los args/inputs `accountId` (el resolver los inyecta del claim):

```text
getAccount(accountId)                 → getAccount
listClients(accountId, …)             → listClients(limit, nextToken)
getClient(accountId, clientId)        → getClient(clientId)
getBankAccount(accountId, …)          → getBankAccount(bankAccountId)
deleteClient(accountId, clientId)     → deleteClient(clientId)
```

Y se quita `accountId` de `PutAccountInput`, `PutClientInput`, `PutBankAccountInput`.

`src/lib/appsync/*` deja de enviar `accountId`. El frontend puede mostrar el `accountId` (desde la sesión, solo
informativo) pero no lo envía como autoridad.

### Detalles de aislamiento adicionales

- **`getInvoiceByNumber`:** con numeración por cuenta, scopea `WHERE invoice_number = :n AND account_id = :acc`.
- **Secciones y líneas de invoice:** no tienen `account_id` propio (cuelgan del invoice por FK). Toda mutación
  (`putInvoiceSection`, `deleteInvoiceSection`, `putInvoiceLineItem`, `deleteInvoiceLineItem`) y los field resolvers
  (`Invoice.sections`, `InvoiceSection.lineItems`) **validan pertenencia mediante JOIN hasta `invoices.account_id = :acc`**.
  Sin ese JOIN, un atacante podría tocar secciones/líneas de otra cuenta por id.
- **`requestInvoicePdf`:** el resolver propaga el `accountId` del claim a la Lambda, que solo lee invoices de esa cuenta.
- **Numeración server-side:** el número se asigna dentro de `putInvoice` (transacción + contador). El
  `getNextInvoiceNumber` del frontend (hoy trae 100 filas y calcula el máximo) **queda obsoleto y se elimina**.

## Audit log (DynamoDB)

Tabla `audit-log` append-only:

- **PK** = `accountId`, **SK** = `timestamp#ulid` (bitácora cronológica por cuenta).
- **GSI** `byEntity` (`accountId`, `entityType#entityId`) (historial de un registro).
- Campos: `actor` (userId/email del claim), `action` (`CREATE`/`UPDATE`/`DELETE`/`STATUS_CHANGE`), `entityType`,
  `entityId`, `before`/`after` (o resumen), `ip` si disponible, `at`. TTL opcional (~2 años).

**Escritura sin acoplar:** **pipeline resolvers** de AppSync — función 1 = SQL en Postgres (Data API),
función 2 = `PutItem` en DynamoDB. Mantiene `actor`/`accountId` desde los claims.

**Acciones auditadas en el MVP:** cambios en datos bancarios, borrado de clientes, cambio de status de invoice y
cambios de perfil de cuenta. El resto se suma después.

## Tokens en NextAuth

1. **No exponer tokens al cliente:** quitar `idToken`/`accessToken` del objeto `session` (`src/auth.ts`). Permanecen
   solo en el JWT cifrado server-side; `appsyncRequest` los lee de ahí.
2. **Refresh token:** guardar el `refreshToken` de Cognito en el JWT y renovar el `idToken` en el callback `jwt`
   cuando esté por expirar (hoy expira a los 60 min y las llamadas a AppSync fallan con la sesión "viva").
3. **Quitar el modo de auth IAM** de AppSync (`additionalAuthorizationModes: [IAM]`) si nada lo usa.

## Procesamiento de archivos (Lambdas en Python)

Todo lo que sea I/O con archivos físicos se hace en **Lambdas Python**, no en los resolvers de datos.

- **Casos:** generación de invoices en PDF; ingesta de un PO desde PDF (procesar → guardar en S3 → escribir datos);
  import/export y adjuntos en general.
- **Invocación:**
  - Síncrono request/response → **AppSync Lambda data source** (como `requestInvoicePdf` hoy).
  - Procesamiento pesado → **asíncrono por evento S3** o cola, para no bloquear la petición.
- **Dentro de la Lambda:** `boto3` → `rds-data` (Data API) para escribir en Postgres + S3 para los archivos.
- **Aislamiento:** la Lambda recibe/propaga el `accountId` y lo aplica en sus escrituras (igual que los resolvers).
- **PDF lambda existente** (`generate-invoice-pdf`, hoy TypeScript/Playwright): se porta a Python en el camino, o se
  mantiene en TS a corto plazo si el deadline aprieta (decisión de ejecución; no bloquea la fundación). Las Lambdas
  **nuevas** de archivos nacen en Python.
- La ingesta de PO desde PDF pertenece al **sub-proyecto #2 (Proyectos)**; aquí solo se fija el patrón.

## Cambios de infraestructura (CDK)

- **Eliminar:** las ~10 tablas DynamoDB de dominio + GSIs.
- **Añadir:** cluster Aurora Serverless v2 (Postgres) con Data API habilitado y credenciales en Secrets Manager;
  tabla DynamoDB `audit-log` (PK/SK + GSI `byEntity`, TTL).
- **Cambiar:** data sources de AppSync de `DynamoDbDataSource` a `RdsDataSource`; pipeline resolvers para las
  mutaciones auditadas (RDS + DynamoDB).
- Cognito: añadir atributo personalizado `custom:accountId` (inmutable) legible por el app client.
- S3 (PDFs) sin cambios.

## Migración / backfill del piloto

1. Provisionar Aurora y correr el DDL.
2. Crear la fila `accounts` del piloto (`id` = accountId elegido) y setear `custom:accountId` en los usuarios Cognito.
3. Backfill de invoices/sections/line-items desde DynamoDB, con `account_id` = piloto, preservando relaciones.
4. Sembrar `invoice_counters` con `max(invoice_number)` del piloto.
5. Cutover en ventana de mantenimiento: desplegar, backfill, verificar, conmutar. Conservar tablas DynamoDB viejas
   unos días como rollback; luego eliminarlas.
6. Script `tsx` único, idempotente donde se pueda, con verificación de conteos y totales.

## Estrategia de pruebas

Introducir **Vitest**. Tests:

- **Aislamiento por tenant (críticos):** cuentas A y B; como A, leer/actualizar/borrar entidades de B por id ⇒
  `null` / `unauthorized` / 0 filas.
- **Claim ausente** ⇒ `unauthorized`.
- **Numeración concurrente:** `putInvoice` en paralelo ⇒ sin duplicados.
- **Tokens:** `session` no expone tokens; el refresh renueva el `idToken`.
- **Audit log:** cada mutación sensible escribe entrada correcta.
- **Backfill:** conteos/totales coinciden; sin huérfanos.

Integración de resolvers/SQL contra Postgres local (docker) o Aurora desechable.

## Riesgos y mitigaciones

- **Re-escritura de ~20 resolvers a SQL bajo deadline.** Mitigación: el contrato GraphQL casi no cambia; se hace
  entidad por entidad con tests de aislamiento como red de seguridad.
- **Data API: límites de latencia/tamaño de request.** A escala MVP es suficiente; revisar si aparecen consultas grandes.
- **Cutover.** Volumen chico (un piloto) ⇒ ventana de mantenimiento corta y rollback con tablas Dynamo conservadas.
- **Costo baseline de Aurora.** Serverless v2 puede auto-pausar; monitorear ACUs.

## Secuencia hacia el 31 de julio

1. Infra: Aurora + Data API + `audit-log` + `custom:accountId` + esquema SQL.
2. Resolvers entidad por entidad (accounts → clients → bank → invoices) con tests de aislamiento.
3. Numeración atómica + cascada de borrado.
4. Audit log (pipeline resolvers) en las 4 acciones sensibles.
5. NextAuth: tokens fuera de la sesión + refresh + quitar IAM.
6. Migración/backfill del piloto + verificación.
7. → Spec #2: Proyectos + pipeline sobre esta base.

# Arquitectura implementada: CRM multi-tenant

Este documento describe la arquitectura actual de `app-finances`. El sistema cubre cuentas, clientes, CRM comercial, operaciones, facturación, cobros y conciliación bancaria con persistencia en Aurora PostgreSQL.

## Objetivo de negocio

Cada usuario autenticado opera dentro de una cuenta de negocio (`Account`), de tipo `SELF_EMPLOYED` o `COMPANY`. La cuenta agrupa y aísla:

- miembros y permisos;
- clientes y contactos;
- oportunidades y pipeline;
- proyectos, tareas y calendario;
- facturas, pagos, movimientos bancarios y conciliaciones;
- auditoría de operaciones sensibles.

## Principios

- Aislamiento multi-tenant mediante `accountId`/`account_id` en todas las entidades de dominio.
- Autenticación con Cognito y autorización de negocio por membresía activa.
- Acceso a dominio mediante AppSync y resolvers RDS; el navegador no recibe tokens de AppSync.
- Consultas orientadas a tenant e índices de negocio, sin `Scan` en los flujos RDS.
- Claves foráneas compuestas para impedir referencias entre cuentas.
- Auditoría append-only para mutaciones sensibles.
- Números bancarios expuestos solo en formato enmascarado.
- Idempotencia y consistencia financiera reforzadas en PostgreSQL, no solo en la UI o en resolvers.

## Componentes

### Aplicación

- Next.js App Router y React para server components y vistas interactivas.
- NextAuth v5 para la sesión, con Cognito como proveedor de identidad.
- `src/lib/appsync/invoices.ts`, `workspace.ts` y `crm.ts` como clientes GraphQL server-only.
- Server actions autenticadas y validadas con Zod en `src/actions/`.
- GraphQL Code Generator para validar documentos y generar tipos desde `infra/graphql/schema.graphql`.

Los componentes CRM reciben datos iniciales desde sus páginas server. Las mutaciones de etapa, estado, favoritos, tareas, eventos y cobros usan actualización optimista con reversión ante errores. El fallback demo está limitado al desarrollo con `DEV_AUTH_BYPASS=true`.

### Backend AWS

- Amazon Cognito User Pool para autenticación.
- AWS AppSync como API GraphQL, con Cognito User Pool como modo de autenticación.
- Aurora PostgreSQL Serverless v2 como fuente de verdad del dominio.
- DynamoDB `user-memberships` para membresías por usuario y cuenta.
- DynamoDB `audit-log` para auditoría append-only con TTL e índice por entidad.
- DynamoDB para metadatos de generación de PDF.
- S3 y Lambda para PDFs de factura.
- CloudWatch para métricas y alarmas de AppSync y Lambda.
- AWS CDK para stacks independientes de backend y frontend por stage.

## Autenticación y autorización

1. El usuario inicia sesión contra Cognito mediante NextAuth.
2. El servidor renueva y obtiene el ID token cuando necesita invocar AppSync.
3. AppSync valida el token con el User Pool; no existe un modo IAM alternativo para las operaciones de la aplicación.
4. El pipeline `RequireMembershipFn` obtiene el `userId` de los claims y exige una membresía `ACTIVE`.
5. La función propaga el `accountId` autorizado al resolver RDS.
6. Cada consulta y mutación SQL filtra por `account_id`.
7. Las mutaciones CRM pasan además por el pipeline de auditoría antes de devolver la respuesta.

Una membresía ausente o suspendida se rechaza antes de acceder al dominio. Las operaciones administrativas siguen reservadas para roles `OWNER` o `ADMIN`.

## Modelo de dominio

### Cuenta y acceso

- `Account`: identidad legal y comercial de la cuenta.
- `UserMembership`: usuario, rol `OWNER|ADMIN|MEMBER` y estado.
- `BankAccount`: beneficiario, banco, moneda y referencias bancarias enmascaradas.

### CRM

- `Client`: empresa, estado, industria, sitio web, responsable, etiquetas y notas.
- `Contact`: persona, relación, datos de contacto, valor estimado y favorito por usuario.
- `Opportunity`: cliente/contacto, valor, etapa, probabilidad, origen, responsable y siguiente acción.

### Operaciones

- `Project`: cliente, oportunidad, estado, prioridad, progreso, fechas, presupuesto y equipo.
- `CrmTask`: tarea, vencimiento, prioridad, tipo, estado, responsable y referencias opcionales a entidades CRM.
- `CalendarEvent`: rango temporal, zona horaria, tipo, responsable, ubicación y referencias CRM.

### Finanzas

- `Invoice`: factura tenant-scoped, cliente, vencimiento, moneda, total y estado.
- `Payment`: cobro aplicado a una factura, referencia idempotente, método y estado de conciliación.
- `BankMovement`: movimiento importado o registrado, cuenta bancaria, fechas, referencia y payload de origen.
- `PaymentReconciliation`: asignación entre pago y movimiento, importe, actor y posible reversión.

## Persistencia Aurora

Las migraciones de `db/migrations/` son la definición versionada del modelo:

- `0001_init.sql`: tablas base de cuentas, clientes, cuentas bancarias y facturas.
- `0002_invoice_client_tenant_fk.sql`: FK compuesta de factura a cliente.
- `0003_crm.sql`: enums, extensión de clientes y facturas, y tablas `contacts`, `contact_favorites`, `opportunities`, `projects`, `crm_tasks`, `calendar_events`, `payments`, `bank_movements` y `payment_reconciliations`.
- `0004_crm_financial_invariants.sql`: restricciones, índices parciales y triggers para pagos, anulaciones, conciliaciones, reversiones y estados de factura.

El entorno PostgreSQL local usa Knex con una fuente de migraciones SQL. Knex controla orden, transacción, bloqueo y su tabla `knex_migrations`; el runner conserva y sincroniza `schema_migrations` para que las bases creadas antes de esta adopción no vuelvan a ejecutar migraciones ya aplicadas. Aurora continúa usando el runner equivalente de RDS Data API porque Knex no se conecta mediante esa API.

Los índices principales siguen los accesos de la aplicación: cuenta + estado + fecha, cuenta + responsable, cuenta + cliente y cuenta + próxima acción. Las relaciones entre clientes, contactos, oportunidades, proyectos, tareas, eventos, facturas y pagos incluyen `account_id` para que PostgreSQL rechace referencias cruzadas incluso si un resolver fuera defectuoso.

## Invariantes financieros

La migración `0004` agrega garantías de base de datos:

- `payments(account_id, reference)` es único para que el registro sea idempotente por tenant.
- La identidad externa de un movimiento bancario es única por cuenta y cuenta bancaria.
- Una conciliación activa entre pago y movimiento no puede duplicarse.
- Las conciliaciones son append-only: PostgreSQL bloquea su borrado y cualquier edición distinta de una reversión con actor, fecha y motivo completos.
- Un pago anulado conserva actor y motivo y no puede conciliarse.
- Solo movimientos de crédito pueden asignarse a pagos.
- Pago y movimiento deben usar la misma moneda.
- La suma asignada no puede superar el pago ni el movimiento.
- Triggers serializan los registros afectados y recalculan el estado `UNRECONCILED|RECONCILED|VOIDED`.
- La factura pasa a `PAID` solo cuando sus pagos conciliados cubren el total; una reversión puede devolverla a `SENT`.
- La fecha de vencimiento de una factura no puede preceder su fecha de emisión.

## API GraphQL CRM

El schema expone conexiones paginadas y filtros para:

- `listContacts`, `listOpportunities`, `listProjects` y `listTasks`;
- `listCalendarEvents` por rango temporal;
- `listPayments` y `listBankMovements`;
- `getCrmSummary` para KPIs;
- `searchWorkspace` para búsqueda global.

Las mutaciones incluyen altas/ediciones (`put*`), eliminaciones, favoritos, cambios de etapa/estado, completar tareas, registrar/anular pagos, registrar movimientos, conciliar y revertir conciliaciones. Los documentos usados por el frontend se validan con `npm run codegen`.

## Auditoría

Las mutaciones CRM sensibles usan resolvers pipeline:

1. validación de membresía;
2. ejecución RDS tenant-scoped;
3. escritura de un evento de auditoría append-only;
4. retorno de la entidad o resultado.

La auditoría registra cuenta, actor, acción, entidad y metadatos permitidos. No debe almacenar números bancarios completos, tokens ni payloads sensibles sin filtrado.

## Validación

Aplicación:

```bash
npm run codegen
npm run lint
npm test
npm run build
```

Backend e infraestructura:

```bash
cd infra
npm run build:resolvers
npm run build
npm test
npm run cdk:synth
```

La cobertura incluye validación del schema y documentos GraphQL, builders SQL, aislamiento tenant, auditoría, migraciones e invariantes de conciliación.

## Despliegue y migraciones

Orden recomendado por stage:

1. Compilar resolvers, ejecutar pruebas y sintetizar CDK.
2. Desplegar `AppFinances-Backend-<stage>` con el contexto Cognito/secret correspondiente.
3. Aplicar las migraciones Aurora mediante RDS Data API:

   ```bash
   cd infra
   DB_CLUSTER_ARN='arn:aws:rds:...' \
   DB_SECRET_ARN='arn:aws:secretsmanager:...' \
   DB_NAME='app_finances' \
   npm run db:migrate:aurora
   ```

4. Verificar consultas CRM, registro idempotente de pagos, conciliación y reversión.
5. Desplegar `AppFinances-Frontend-<stage>`.

Los scripts `npm run cdk:deploy:dev` y `npm run cdk:deploy:prod` despliegan ambos stacks; para un cutover controlado se recomienda desplegarlos por nombre y ejecutar las migraciones entre backend y frontend.

## Estado

- Fundación multi-tenant, Cognito, membresías y aislamiento: implementados.
- Clientes, cuentas bancarias y facturas tenant-scoped: implementados.
- Contactos, oportunidades, proyectos, tareas y calendario persistentes: implementados.
- Pagos, movimientos, conciliación y reversiones con invariantes RDS: implementados.
- Resumen CRM, búsqueda global y reportes conectados: implementados.
- Auditoría, refresh server-side de tokens, backfill y alarmas: implementados en código.

Cada entorno requiere desplegar los stacks y aplicar las migraciones antes de habilitar el frontend correspondiente.

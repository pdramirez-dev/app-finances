# Nexo

Centro de gestión empresarial multi-tenant para administrar el ciclo completo desde la relación comercial hasta el proyecto, la factura, el cobro y la conciliación bancaria.

## Stack actual

- Next.js App Router, React y TypeScript.
- NextAuth v5 con proveedor Credentials sobre Amazon Cognito.
- AWS AppSync GraphQL, autenticado exclusivamente con Cognito User Pools.
- Aurora PostgreSQL Serverless v2 para las entidades de dominio CRM y financieras.
- DynamoDB para membresías, auditoría append-only y metadatos de PDF.
- S3 y Lambda para documentos de factura.
- AWS CDK para infraestructura y despliegues por entorno.

## Funcionalidades persistentes

- Panel ejecutivo con resumen CRM y financiero (`/dashboard`).
- Clientes, contactos y favoritos por usuario.
- Pipeline de oportunidades con etapas, responsables, próximas acciones y búsqueda (`/pipeline`).
- Portafolio de proyectos con presupuesto, avance y equipo (`/projects`).
- Tareas vinculables y calendario operativo (`/tasks`, `/calendar`).
- Facturas, pagos, movimientos bancarios y conciliación (`/invoices`, `/payments`).
- Reportes y búsqueda global del espacio de trabajo.
- Shell responsive, navegación móvil y creación rápida.

Los módulos CRM consumen AppSync desde el servidor mediante `src/lib/appsync/crm.ts`. Las escrituras pasan por server actions autenticadas y validadas con Zod en `src/actions/crm.ts`. Los datos demo solo se usan como fallback local cuando `NODE_ENV=development` y `DEV_AUTH_BYPASS=true`; no son la fuente de datos de un entorno desplegado.

## Persistencia CRM

Las migraciones se aplican en orden:

- `0001_init.sql`: cuentas, clientes, datos bancarios y facturas.
- `0002_invoice_client_tenant_fk.sql`: integridad compuesta entre factura, cliente y tenant.
- `0003_crm.sql`: metadatos de clientes, contactos, favoritos, oportunidades, proyectos, tareas, calendario, pagos, movimientos bancarios y conciliaciones.
- `0004_crm_financial_invariants.sql`: idempotencia de pagos, conciliación serializada, ledger append-only, reversiones, anulaciones y sincronización transaccional del estado de pago/factura.

Todas las tablas de dominio incluyen `account_id`. Las relaciones sensibles usan claves foráneas compuestas para impedir asociaciones entre tenants.

## Variables de entorno

Copiar `.env.example` a `.env` y completar los valores:

```env
AUTH_SECRET="replace_with_a_strong_random_secret"
AUTH_URL="http://localhost:3000"

AUTH_COGNITO_USER_POOL_ID="us-east-1_XXXXXXXXX"
AUTH_COGNITO_USER_POOL_CLIENT_ID="replace_with_user_pool_client_id"
AUTH_COGNITO_SECRET=""

APPSYNC_GRAPHQL_URL="https://<appsync-id>.appsync-api.us-east-1.amazonaws.com/graphql"
```

Para migraciones locales también se necesita `DATABASE_URL`. Knex ejecuta los SQL versionados y conserva `schema_migrations` para compatibilidad con instalaciones existentes. El migrador RDS Data API usa `DB_CLUSTER_ARN`, `DB_SECRET_ARN` y, opcionalmente, `DB_NAME`.

## Arranque local

La forma más rápida de probar todo el frontend es:

```bash
npm run local:dev
```

Este comando inicia PostgreSQL, aplica las migraciones con Knex y abre Next.js
en `http://localhost:3000` con autenticación y transporte demo locales. Consulta
la guía de [desarrollo local](docs/LOCAL_DEVELOPMENT.md) para LocalStack y sus
límites de servicio.

El arranque manual equivalente es:

```bash
npm install
npm run codegen
npm run dev
```

El modo local sin Cognito se habilita de forma explícita:

```bash
DEV_AUTH_BYPASS=true npm run dev
```

## Migraciones

PostgreSQL accesible mediante URL:

```bash
DATABASE_URL='postgresql://...' npm run db:migrate
```

Aurora mediante RDS Data API:

```bash
cd infra
DB_CLUSTER_ARN='arn:aws:rds:...' \
DB_SECRET_ARN='arn:aws:secretsmanager:...' \
DB_NAME='app_nexo' \
npm run db:migrate:aurora
```

En local, Knex descubre directamente los archivos SQL de `db/migrations`, los aplica en orden y registra el lote en `knex_migrations`. También mantiene el registro histórico `schema_migrations`, importándolo automáticamente al adoptar Knex sobre una base ya migrada. Las migraciones son forward-only: una corrección se añade como un nuevo SQL versionado.

Ambos migradores serializan ejecuciones concurrentes. El migrador Aurora registra cada versión y aplica cada archivo dentro de una transacción, por lo que puede reintentarse con seguridad.

## Validación

Aplicación:

```bash
npm run codegen
npm run lint
npm test
npm run build
```

Infraestructura y resolvers:

```bash
cd infra
npm install
npm run build:resolvers
npm run build
npm test
npm run cdk:synth
```

## Despliegue AWS

`infra/` define dos stacks por entorno:

- `AppNexo-Backend-<stage>`: Cognito, AppSync, Aurora, DynamoDB, S3, Lambda PDF y alarmas.
- `AppNexo-Frontend-<stage>`: Amplify Hosting, configurado con los outputs del backend.

Secuencia recomendada para evitar que el frontend consulte tablas aún no migradas:

1. Compilar y validar resolvers e infraestructura.
2. Desplegar `AppNexo-Backend-<stage>`.
3. Aplicar todas las migraciones de Aurora, incluidas `0003` y `0004`.
4. Verificar AppSync y los invariantes de conciliación.
5. Desplegar `AppNexo-Frontend-<stage>`.

Los scripts agrupados están disponibles en `infra/package.json`:

```bash
cd infra
npm run cdk:deploy:dev -- -c devCognitoDomainPrefix=<unique-prefix-dev> -c devAuthSecret=<strong-secret>
npm run cdk:deploy:prod -- -c prodCognitoDomainPrefix=<unique-prefix-prod> -c prodAuthSecret=<strong-secret>
```

Para un despliegue escalonado puede usarse `npx cdk deploy AppNexo-Backend-<stage>` y, después de migrar, `npx cdk deploy AppNexo-Frontend-<stage>` con el mismo contexto del entorno.

## Bootstrap dev

El script crea el backend de desarrollo, un usuario administrador y actualiza `.env`:

```bash
npm run bootstrap:dev -- \
  --domain-prefix <prefijo-cognito-unico> \
  --admin-email <admin@tu-dominio.com> \
  --admin-password '<PasswordFuerte123!>'
```

## Documentación

- Arquitectura implementada: `docs/ARCHITECTURE.md`.
- Infraestructura: `infra/README.md`.
- Seguridad bancaria: `docs/BANK_DATA_SECURITY.md`.
- Auditoría: `docs/AUDIT_LOG_VERIFICATION.md`.
- Backfill: `docs/BACKFILL_PILOT.md`.
- Historial: `CHANGELOG.md`.

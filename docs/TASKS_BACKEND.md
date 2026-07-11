# Tareas Backend

## Completado

- [x] Crear tablas multi-tenant base (`accounts`, `user-memberships`, `clients`, `bank-accounts`) en CDK.
- [x] Exponer outputs de las nuevas tablas para observabilidad y operación.

## Próximas

- [x] Extender `infra/graphql/schema.graphql` con tipos `Account`, `Client`, `BankAccount`.
- [x] Agregar queries y mutations para CRUD de clientes.
- [x] Agregar query/mutation de datos bancarios por cuenta.
- [x] Incluir `UserMembership` en schema y resolver de pertenencia por usuario.
- [x] Implementar validación de membresía por `userId` + `accountId` en resolvers.
- [x] Añadir `accountId` y `clientId` al modelo de invoices.
- [x] Reemplazar `Scan` en listado de invoices por índices orientados a tenant.
- [x] Definir estrategia de cifrado/enmascarado de datos bancarios.
- [x] Definir estrategia de migración de datos existentes (backfill).

## Calidad y seguridad

- [x] Tests de resolver para autorización multi-tenant.
- [x] Pruebas de regresión en flujo actual de invoices.
- [x] Métricas y alarmas en AppSync/Lambda para nuevos módulos.

## Evidencia

- Todos los resolvers de dominio ejecutan primero `RequireMembershipFn`; los miembros suspendidos se rechazan y las operaciones administrativas requieren rol `OWNER` o `ADMIN`.
- Aurora aplica una FK compuesta para impedir asociaciones de invoices con clientes de otro tenant.
- `npm test`: 9 pruebas. `cd infra && npm test`: 53 pruebas, incluidas 9 de integración PostgreSQL.
- AppSync usa exclusivamente Cognito User Pool; los tokens se renuevan server-side y no se exponen en `Session`.
- Backfill: `infra/scripts/backfill-pilot.ts`. Seguridad bancaria: `docs/BANK_DATA_SECURITY.md`.
- CI: `.github/workflows/ci.yml`. Alarmas: AppSync 5XX/latencia y Lambda errores/throttles.

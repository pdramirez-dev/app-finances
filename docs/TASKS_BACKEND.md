# Tareas Backend

## Completado

- [x] Crear tablas multi-tenant base (`accounts`, `user-memberships`, `clients`, `bank-accounts`) en CDK.
- [x] Exponer outputs de las nuevas tablas para observabilidad y operación.
- [x] Implementar el dominio CRM persistente: contactos, oportunidades, proyectos, tareas y calendario.
- [x] Implementar pagos, movimientos bancarios, conciliación y reversión append-only.
- [x] Exponer resumen CRM y búsqueda global tenant-scoped.

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
- [x] Idempotencia de pagos y movimientos bancarios en PostgreSQL.
- [x] Locks y límites transaccionales para impedir sobreasignaciones en conciliación.
- [x] Migraciones locales y Aurora serializadas, transaccionales y versionadas.
- [x] Auditoría de todas las mutaciones CRM con actor y entidad correctos.

## Evidencia

- Todos los resolvers de dominio ejecutan primero `RequireMembershipFn`; los miembros suspendidos se rechazan y las operaciones administrativas requieren rol `OWNER` o `ADMIN`.
- Aurora aplica una FK compuesta para impedir asociaciones de invoices con clientes de otro tenant.
- `npm test`: 19 pruebas, incluidas migraciones limpias, flujo SQL CRM completo e invariantes financieros sobre PostgreSQL real.
- `cd infra && npm test`: 90 pruebas de builders, permisos, auditoría, schema y stack CDK.
- Se compilan 35 resolvers AppSync y el stack backend sintetiza correctamente para `dev`.
- AppSync usa exclusivamente Cognito User Pool; los tokens se renuevan server-side y no se exponen en `Session`.
- Backfill: `infra/scripts/backfill-pilot.ts`. Seguridad bancaria: `docs/BANK_DATA_SECURITY.md`.
- CI: `.github/workflows/ci.yml`. Alarmas: AppSync 5XX/latencia y Lambda errores/throttles.

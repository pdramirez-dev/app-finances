# Tareas Backend

## En curso

- [x] Crear tablas multi-tenant base (`accounts`, `user-memberships`, `clients`, `bank-accounts`) en CDK.
- [x] Exponer outputs de las nuevas tablas para observabilidad y operación.

## Próximas

- [x] Extender `infra/graphql/schema.graphql` con tipos `Account`, `Client`, `BankAccount`.
- [x] Agregar queries y mutations para CRUD de clientes.
- [x] Agregar query/mutation de datos bancarios por cuenta.
- [ ] Incluir `UserMembership` en schema y resolver de pertenencia por usuario.
- [ ] Implementar validación de membresía por `userId` + `accountId` en resolvers.
- [ ] Añadir `accountId` y `clientId` al modelo de invoices.
- [ ] Reemplazar `Scan` en listado de invoices por índices orientados a tenant.
- [ ] Definir estrategia de cifrado/enmascarado de datos bancarios.
- [ ] Definir estrategia de migración de datos existentes (backfill).

## Calidad y seguridad

- [ ] Tests de resolver para autorización multi-tenant.
- [ ] Pruebas de regresión en flujo actual de invoices.
- [ ] Métricas y alarmas en AppSync/Lambda para nuevos módulos.

# Arquitectura Objetivo (Multi-tenant)

Este documento define el modelo de arquitectura para evolucionar `app-finances` desde el alcance actual (invoices) hacia gestión de cuentas, usuarios, clientes y datos bancarios.

## Objetivo de negocio

- Cada usuario autenticado en Cognito debe operar dentro de una cuenta de negocio (`Account`).
- Una cuenta puede ser:
  - `SELF_EMPLOYED`: persona independiente.
  - `COMPANY`: empresa con potencialmente varios usuarios.
- Cada cuenta gestiona:
  - Su lista de clientes.
  - Sus facturas.
  - Sus datos bancarios para recibir pagos.

## Principios técnicos

- Mantener arquitectura serverless: Next.js + NextAuth + Cognito + AppSync + Aurora Serverless v2 + DynamoDB + S3.
- Implementar aislamiento multi-tenant por `accountId` en todas las entidades de dominio.
- Priorizar `Query` por PK/GSI y evitar `Scan` en flujos de negocio.
- Cifrar y enmascarar datos bancarios sensibles.

## Componentes

- Frontend:
  - Next.js App Router.
  - NextAuth v5 con Cognito.
- Backend:
  - AppSync GraphQL (exclusivamente auth Cognito User Pool).
  - Aurora PostgreSQL para entidades de dominio y numeración transaccional.
  - DynamoDB para membresías y auditoría append-only.
  - Lambda para generación de PDF.
  - DynamoDB multi-tabla.
- AuthN/AuthZ:
  - Autenticación: Cognito.
  - Autorización de negocio: membresía del usuario en `Account` + `role`.

## Modelo de dominio

- `Account`
  - `accountId`, `type`, `displayName`, `legalName`, `taxId`, `createdAt`, `updatedAt`.
- `UserMembership`
  - `accountId`, `userId`, `role` (`OWNER|ADMIN|MEMBER`), `status`, `createdAt`, `updatedAt`.
- `Client`
  - `accountId`, `clientId`, `name`, `email`, `phone`, `address`, `taxId`, `createdAt`, `updatedAt`.
- `BankAccount`
  - `accountId`, `bankAccountId`, `beneficiaryName`, `bankName`, identificadores bancarios enmascarados, `currency`, `country`, `createdAt`, `updatedAt`.
- `Invoice` (existente, a migrar)
  - Agregar `accountId` y `clientId` para aislamiento por tenant.

## Persistencia actual

- Aurora PostgreSQL:
  - `accounts`, `clients`, `bank_accounts`, `invoices`, `invoice_sections`, `invoice_line_items` e `invoice_counters`.
  - Todos los accesos se filtran por `account_id`; invoices valida además la relación compuesta con clients.
  - Índices `invoices_by_account_created`, `invoices_by_account_status` y `clients_by_account_name` evitan `Scan`.
- DynamoDB `user-memberships`:
  - PK: `accountId`, SK: `userId`
  - GSI: `byUserId` (`userId`, `accountId`)
- DynamoDB `audit-log`: PK `accountId`, SK temporal, TTL y GSI `byEntity`.

## Flujo de autorización (target)

1. Usuario inicia sesión en Cognito.
2. Frontend obtiene token (NextAuth).
3. En cada operación GraphQL, backend identifica `userId` desde claims.
4. Backend valida membresía activa (`UserMembership`) para el `accountId` de la operación.
5. Una función pipeline rechaza membresías ausentes/suspendidas y reserva cambios administrativos para `OWNER|ADMIN`.
6. Solo entonces ejecuta la operación tenant-scoped sobre Aurora, auditoría o PDF.

## Seguridad de datos bancarios

- No exponer números completos de cuenta en respuestas GraphQL.
- Guardar versión cifrada (KMS) y versión enmascarada para UI.
- Registrar auditoría de cambios en datos bancarios.

## Estado de implementación

- Fase 1: completada — esquema, Aurora, harness y Cognito multi-tenant.
- Fase 2: completada — resolvers Accounts/Clients/BankAccounts y validación de membresía.
- Fase 3: completada — invoices con `accountId`/`clientId`, índices y aislamiento cross-tenant.
- Fase de seguridad backend: completada en código — audit log, refresh de tokens, backfill y alarmas; requiere despliegue/cutover por entorno.
- Fase 4:
  - UI de perfil de cuenta, clientes y datos bancarios.
  - Pruebas E2E de autorización por tenant.

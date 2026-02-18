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

- Mantener arquitectura serverless actual: Next.js + NextAuth + Cognito + AppSync + DynamoDB + S3.
- Implementar aislamiento multi-tenant por `accountId` en todas las entidades de dominio.
- Priorizar `Query` por PK/GSI y evitar `Scan` en flujos de negocio.
- Cifrar y enmascarar datos bancarios sensibles.

## Componentes

- Frontend:
  - Next.js App Router.
  - NextAuth v5 con Cognito.
- Backend:
  - AppSync GraphQL (auth Cognito User Pool).
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

## Diseño DynamoDB (target)

- `accounts`
  - PK: `accountId`
  - GSI: `byTypeCreatedAt` (`type`, `createdAt`)
- `user-memberships`
  - PK: `accountId`, SK: `userId`
  - GSI: `byUserId` (`userId`, `accountId`)
- `clients`
  - PK: `accountId`, SK: `clientId`
  - GSI: `byClientName` (`accountId`, `clientName`)
- `bank-accounts`
  - PK: `accountId`, SK: `bankAccountId`
  - GSI: `byUpdatedAt` (`accountId`, `updatedAt`)
- `invoices` (existente)
  - Hoy usa `invoiceId` como PK.
  - Evolución propuesta: incorporar índice por cuenta (`accountId`, `createdAt` o `status+createdAt`).

## Flujo de autorización (target)

1. Usuario inicia sesión en Cognito.
2. Frontend obtiene token (NextAuth).
3. En cada operación GraphQL, backend identifica `userId` desde claims.
4. Backend valida membresía activa (`UserMembership`) para el `accountId` de la operación.
5. Solo entonces ejecuta operación sobre `Client`, `BankAccount`, `Invoice`.

## Seguridad de datos bancarios

- No exponer números completos de cuenta en respuestas GraphQL.
- Guardar versión cifrada (KMS) y versión enmascarada para UI.
- Registrar auditoría de cambios en datos bancarios.

## Fases de implementación

- Fase 1 (actual):
  - Base documental.
  - Crear tablas multi-tenant nuevas en CDK (`accounts`, `user-memberships`, `clients`, `bank-accounts`).
- Fase 2:
  - Schema GraphQL + resolvers para Accounts/Clients/BankAccounts.
  - Resolvers con validación de membresía.
- Fase 3:
  - Migración de invoices para `accountId`/`clientId`.
  - Refactor de queries de invoices para evitar `Scan`.
- Fase 4:
  - UI de perfil de cuenta, clientes y datos bancarios.
  - Pruebas E2E de autorización por tenant.

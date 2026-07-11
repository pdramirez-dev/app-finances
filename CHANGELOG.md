# Changelog

Todos los cambios importantes del proyecto se documentan en este archivo.

## [Unreleased]

### Added

- Validación central de membresía activa antes de todos los resolvers de dominio.
- Tipo/query `UserMembership` y roles `OWNER|ADMIN|MEMBER`.
- Relación tenant-safe entre invoices y clients mediante FK compuesta.
- Refresh automático de tokens Cognito sin exponerlos en la sesión del navegador.
- Backfill idempotente DynamoDB → PostgreSQL con verificación de conteos.
- Alarmas CloudWatch para AppSync y la Lambda de PDF.
- CI con PostgreSQL para tests de migración, regresión y aislamiento.
- Política de enmascarado de datos bancarios.

- Documento de arquitectura objetivo multi-tenant en `docs/ARCHITECTURE.md`.
- Backlog inicial de backend en `docs/TASKS_BACKEND.md`.
- Backlog inicial de frontend en `docs/TASKS_FRONTEND.md`.
- Tablas DynamoDB base para multi-tenant en CDK:
  - `accounts`
  - `user-memberships`
  - `clients`
  - `bank-accounts`
- Schema GraphQL extendido con:
  - `Account`
  - `Client`
  - `BankAccount`
- Nuevos resolvers AppSync:
  - `getAccount`, `putAccount`
  - `listClients`, `getClient`, `putClient`, `deleteClient`
  - `getBankAccount`, `putBankAccount`

### Planned

- Módulos de gestión de cuenta (self-employed/compañía), clientes y datos bancarios.
- Aislamiento multi-tenant por `accountId` en facturas y consultas.

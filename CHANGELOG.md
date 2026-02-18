# Changelog

Todos los cambios importantes del proyecto se documentan en este archivo.

## [Unreleased]

### Added

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

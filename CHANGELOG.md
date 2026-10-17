# Changelog

Todos los cambios importantes del proyecto se documentan en este archivo.

## [Unreleased]

### Fixed

- El tablero del pipeline desplazaba toda la página en móvil (textos `sr-only` absolutos escapaban del contenedor con scroll).

### Added

- Calidad de formularios: mensajes de zod en español (locale `es`), errores junto a cada campo con `aria-invalid`/`aria-describedby`, y los datos tecleados se conservan tras un envío fallido.
- Pruebas end-to-end con Playwright (flujos de cuenta, cliente, banco, factura y configuración) y verificación responsive a 390px; job `e2e` en CI.
- Recordatorios de pago: envío diario automático (opt-in por cuenta, días configurables respecto al vencimiento, sin recordatorios atrasados al activarlos, deduplicados con reserva previa) y recordatorio manual desde la factura con historial. Migración `0006_payment_reminders`.
- Envío de facturas por email: PDF generado en el servidor (pdf-lib) y guardado en S3; el email lleva un enlace firmado (30 días) que redirige a una URL prefirmada de S3 de 5 minutos. Los borradores pasan a Enviada y cada envío queda auditado.
- Numeración de facturas por serie: series con código propio (p. ej. `A-0001`), número inicial configurable, serie predeterminada por cuenta y archivado. Las facturas sin serie conservan la numeración general (migración `0005_invoice_series`).
- Edición de facturas existentes (`updateInvoiceFull`): reemplaza datos, secciones y conceptos en una sola sentencia atómica, conserva número y estado, bloquea facturas pagadas y queda auditada.
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

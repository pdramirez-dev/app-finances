# Backfill del piloto

El backfill migra clientes, datos bancarios enmascarados, invoices, secciones y líneas desde las
tablas DynamoDB históricas hacia Aurora. Es idempotente, actualiza registros del mismo tenant,
siembra `invoice_counters` y compara los conteos finales.

## Orden de ejecución

1. Crear un snapshot/export de las tablas DynamoDB de origen.
2. Desplegar el backend y aplicar `db/migrations/0001_init.sql` y `0002_invoice_client_tenant_fk.sql`.
3. Asignar `custom:accountId` al usuario piloto y crear su membresía `ACTIVE`.
4. Ejecutar el backfill durante una ventana sin escrituras.
5. Verificar `listInvoices`, `getInvoice`, clientes y numeración de una factura nueva.
6. Conservar el snapshot hasta completar la aceptación del piloto.

## Ejecución

```bash
cd infra
AWS_REGION=us-east-1 \
STAGE=dev \
DB_CLUSTER_ARN='arn:aws:rds:...' \
DB_SECRET_ARN='arn:aws:secretsmanager:...' \
PILOT_ACCOUNT_ID='00000000-0000-4000-8000-000000000000' \
PILOT_ACCOUNT_NAME='Empresa piloto' \
npm run backfill:pilot
```

Los nombres de tablas pueden sobrescribirse con `SOURCE_CLIENTS_TABLE`,
`SOURCE_BANK_ACCOUNTS_TABLE`, `SOURCE_INVOICES_TABLE`, `SOURCE_INVOICE_SECTIONS_TABLE` y
`SOURCE_INVOICE_LINE_ITEMS_TABLE`.

El script se detiene si encuentra un identificador bancario sin máscara o si los conteos de
invoices, secciones y líneas no coinciden. No elimina ni modifica las tablas de origen.

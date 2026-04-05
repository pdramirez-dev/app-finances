# App Finances

App web para generar y administrar invoices.

## Stack actual

- Next.js (App Router + TypeScript)
- NextAuth v5 con proveedor Credentials sobre Cognito
- AWS AppSync (GraphQL)
- DynamoDB (multi-tabla)
- S3 (PDFs)
- CDK para infraestructura (`infra/`)

## Documentación de arquitectura y roadmap

- Arquitectura objetivo multi-tenant: `docs/ARCHITECTURE.md`
- Changelog del proyecto: `CHANGELOG.md`
- Backlog backend: `docs/TASKS_BACKEND.md`
- Backlog frontend: `docs/TASKS_FRONTEND.md`

## Funcionalidades

- Login protegido (`/login`) con UI custom sobre Cognito
- Lista de invoices (`/invoices`)
- Crear invoice con secciones y line items (`/invoices/new`)
- Ver detalle y actualizar status (`DRAFT`, `SENT`, `PAID`)
- Eliminar invoice
- Vista de impresión/PDF (`/invoices/[id]/print`)

## Variables de entorno

Copiar `.env.example` a `.env` y completar valores:

```env
AUTH_SECRET="replace_with_a_strong_random_secret"
AUTH_URL="http://localhost:3000"

AUTH_COGNITO_USER_POOL_ID="us-east-1_XXXXXXXXX"
AUTH_COGNITO_USER_POOL_CLIENT_ID="replace_with_user_pool_client_id"
AUTH_COGNITO_SECRET=""

APPSYNC_GRAPHQL_URL="https://<appsync-id>.appsync-api.us-east-1.amazonaws.com/graphql"
```

## Arranque local

```bash
npm install
npm run dev
```

## Bootstrap dev (AWS)

Script para crear Cognito/AppSync backend dev, crear usuario admin y actualizar `.env`:

```bash
npm run bootstrap:dev -- \
  --domain-prefix <prefijo-cognito-unico> \
  --admin-email <admin@tu-dominio.com> \
  --admin-password '<PasswordFuerte123!>'
```

## Infraestructura AWS (CDK)

`infra/` define dos stacks por entorno:

- `AppFinances-Backend-<stage>`: Cognito, AppSync, DynamoDB, S3, Lambda PDF
- `AppFinances-Frontend-<stage>`: Amplify Hosting (consume outputs del backend)

Ver detalles y comandos en `infra/README.md`.

## Scripts

- `npm run dev`: entorno local
- `npm run lint`: lint
- `npm run build`: build producción

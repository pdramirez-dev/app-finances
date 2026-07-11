# Infraestructura CDK

Infra de `app-finances` con separación frontend/backend por entorno.

## Stacks por entorno

- `AppFinances-Backend-<stage>`
  - Cognito (User Pool + App Client + Hosted UI domain)
  - AppSync (GraphQL)
  - Aurora PostgreSQL Serverless v2 para accounts, clients, bank accounts e invoices
  - DynamoDB para membresías, auditoría append-only y metadatos PDF
  - S3 para PDFs
  - Lambda de generación PDF
- `AppFinances-Frontend-<stage>`
  - Amplify app + branch
  - Variables de entorno para Next.js (AppSync + Cognito)

## Entornos

- `dev`
- `prod`

## AppSync

- Schema: `infra/graphql/schema.graphql`
- Resolvers: fuentes en `infra/graphql/resolvers/src`, compilados con `npm run build:resolvers`
- Auth principal: Cognito User Pool
- Cada operación de dominio valida primero una membresía `ACTIVE` por `accountId + userId`
- No existe modo de autenticación IAM adicional
- CloudWatch: alarmas de errores/latencia AppSync y errores/throttles de Lambda

## Comandos

```bash
cd infra
npm install
npm run build:resolvers
npm test
npm run cdk:bootstrap
npm run cdk:synth
npm run cdk:deploy:dev -- -c devCognitoDomainPrefix=<unique-prefix-dev> -c devAuthSecret=<strong-secret>
npm run cdk:deploy:prod -- -c prodCognitoDomainPrefix=<unique-prefix-prod> -c prodAuthSecret=<strong-secret>
```

## Migración del piloto

Después del deploy y de aplicar las migraciones, ejecutar `npm run backfill:pilot` con los ARN de
Aurora y `PILOT_ACCOUNT_ID`. El procedimiento completo está en `docs/BACKFILL_PILOT.md`.

Para ambos entornos:

```bash
npm run cdk:deploy -- -c devCognitoDomainPrefix=<unique-prefix-dev> -c prodCognitoDomainPrefix=<unique-prefix-prod> -c devAuthSecret=<strong-secret> -c prodAuthSecret=<strong-secret>
```

## Nota importante

- Puedes pasar `devAuthSecret` / `prodAuthSecret` por contexto para poblar `AUTH_SECRET` en Amplify.
- Ajusta `appUrl`, `callbackUrls` y `logoutUrls` en `infra/lib/stage-config.ts` antes de desplegar.

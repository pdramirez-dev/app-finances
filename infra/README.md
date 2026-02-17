# Infraestructura CDK

Infra de `app-finances` con separación frontend/backend por entorno.

## Stacks por entorno

- `AppFinances-Backend-<stage>`
  - Cognito (User Pool + App Client + Hosted UI domain)
  - AppSync (GraphQL)
  - DynamoDB multi-tabla
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
- Resolvers: `infra/graphql/resolvers/*.js` (1 resolver por archivo)
- Auth principal: Cognito User Pool
- Auth adicional: IAM

## Comandos

```bash
cd infra
npm install
npm run cdk:bootstrap
npm run cdk:synth
npm run cdk:deploy:dev -- -c devCognitoDomainPrefix=<unique-prefix-dev> -c devAuthSecret=<strong-secret>
npm run cdk:deploy:prod -- -c prodCognitoDomainPrefix=<unique-prefix-prod> -c prodAuthSecret=<strong-secret>
```

Para ambos entornos:

```bash
npm run cdk:deploy -- -c devCognitoDomainPrefix=<unique-prefix-dev> -c prodCognitoDomainPrefix=<unique-prefix-prod> -c devAuthSecret=<strong-secret> -c prodAuthSecret=<strong-secret>
```

## Nota importante

- Puedes pasar `devAuthSecret` / `prodAuthSecret` por contexto para poblar `AUTH_SECRET` en Amplify.
- Ajusta `appUrl`, `callbackUrls` y `logoutUrls` en `infra/lib/stage-config.ts` antes de desplegar.

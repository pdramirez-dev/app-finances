# GitHub Actions OIDC

Este repo usa GitHub Actions con OIDC para asumir un rol temporal en AWS. No guardes `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY` en GitHub.

## 1. Crear el identity provider en AWS

En IAM, crea un OpenID Connect provider:

- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

## 2. Crear el rol IAM

Trust policy para este repo:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:pdramirez-dev/app-finances:ref:refs/heads/main",
            "repo:pdramirez-dev/app-finances:ref:refs/heads/develop"
          ]
        }
      }
    }
  ]
}
```

## 3. Permisos del rol

Para disparar y esperar deployments de Amplify:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "amplify:StartJob",
        "amplify:GetJob"
      ],
      "Resource": "*"
    }
  ]
}
```

Puedes restringir el `Resource` a los ARN de tus apps de Amplify cuando tengas los app IDs finales.

## 4. Variables en GitHub

En GitHub, configura estas repository variables:

- `AWS_REGION`: región AWS, por ejemplo `us-east-1`
- `AWS_ROLE_TO_ASSUME`: ARN del rol OIDC, por ejemplo `arn:aws:iam::<AWS_ACCOUNT_ID>:role/app-finances-actions-deploy`
- `AMPLIFY_APP_ID_PROD`: app id de Amplify para prod
- `AMPLIFY_APP_ID_DEV`: app id de Amplify para dev

## 5. Flujo de deploy

El workflow `.github/workflows/deploy-amplify.yml` hace:

- `npm ci`
- `npm run build`
- `cd infra && npm ci`
- `cd infra && npm run build`
- asume el rol AWS con OIDC
- dispara `aws amplify start-job --job-type RELEASE`
- espera hasta que el deploy termine

La rama `main` usa `AMPLIFY_APP_ID_PROD`. La rama `develop` usa `AMPLIFY_APP_ID_DEV`.

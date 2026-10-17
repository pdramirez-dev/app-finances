# Backend completo en local con Floci

[Floci](https://floci.io) es un emulador de AWS gratuito (MIT). Con él corre en local el stack de backend real
desplegado con CDK: Cognito, AppSync (resolvers `APPSYNC_JS`), Aurora PostgreSQL vía Data API, Lambda, S3, SES,
Secrets Manager, DynamoDB y EventBridge. Es la forma de probar de punta a punta sin una cuenta de AWS.

## Requisitos

- Docker o Podman (Floci levanta contenedores para Lambda, Postgres y el runtime de AppSync).
- AWS CLI y las dependencias de `infra/` instaladas.

## Uso

```bash
bash scripts/floci/up.sh          # Floci + bootstrap + deploy + migraciones + datos de prueba (~2 min)
set -a; source .floci/app.env; set +a
npx next dev --webpack            # la app contra Floci, con login real de Cognito
```

Usuario de prueba: `owner@floci-demo.example` / `Floci-Pass-123!` (cuenta `11111111-1111-4111-8111-111111111111`,
rol OWNER). Las salidas del stack quedan en `.floci/outputs.json`. Los emails enviados se consultan en
`http://localhost:4566/_aws/ses`.

Para detenerlo: `podman rm -f floci` (o `docker rm -f floci`). El estado vive en memoria; `up.sh` lo recrea.

## Qué se probó (2026-10-17, Floci 2.3.0)

- Login con Cognito (`USER_PASSWORD_AUTH`) y JWT con `custom:accountId`.
- AppSync con el guard de membresía en DynamoDB, los resolvers RDS sobre el Data API y la auditoría.
- Clientes, series, facturas con secciones, edición con control de versión (la edición desactualizada se rechaza),
  datos bancarios enmascarados, búsqueda, configuración de recordatorios.
- Lambda de envío: PDF en S3 bajo el prefijo de la cuenta, enlace firmado → 302 → URL prefirmada → PDF; token
  alterado → 410. SES rechaza remitentes no verificados, como el sandbox real.
- Lambda programada de recordatorios: envía una vez y no duplica en la siguiente ejecución.

## Diferencias con AWS que hay que conocer

| Floci | Cómo se maneja |
|---|---|
| AppSync exige `Authorization: Bearer <token>`; AWS acepta el token solo | `APPSYNC_AUTH_HEADER_PREFIX="Bearer "` en `.floci/app.env` (solo local) |
| Los recursos personalizados de CDK responden por `https://` y Floci da URLs `http://` | `-c localEmulator=true` desactiva `autoDeleteObjects` del bucket |
| No acepta código de resolvers desde S3 | `-c localEmulator=true` pone el código inline en la plantilla |
| Variables GraphQL explícitamente `null` provocan un error interno | la app omite `nextToken` en vez de enviarlo `null` |
| Sin DNS para `bucket.floci` en Podman | las Lambdas usan direcciones de S3 por ruta cuando hay `AWS_ENDPOINT_URL` |
| Un dominio de SES no se verifica (no hay DNS) | `up.sh` verifica la dirección del remitente |
| Los permisos de IAM no se evalúan | los permisos se cubren con los tests del stack |
| Los nombres `floci` y `*.floci` no resuelven desde el host | los enlaces de descarga se prueban con `curl --resolve` |

Que algo funcione en Floci no garantiza que funcione en AWS; antes de producción hace falta un stack `dev` real.

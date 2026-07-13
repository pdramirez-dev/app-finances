# Desarrollo local con PostgreSQL y LocalStack

El entorno local separa explícitamente dos responsabilidades:

- PostgreSQL 16 sustituye Aurora PostgreSQL para ejecutar migraciones y probar el dominio.
- LocalStack provisiona tres tablas DynamoDB, el bucket S3 y deja Lambda disponible. Cognito puede habilitarse opcionalmente.

## Requisitos

- Docker con Docker Compose.
- Node.js y las dependencias del proyecto.
- Un `LOCALSTACK_AUTH_TOKEN`. Desde marzo de 2026 LocalStack requiere una licencia asignada y un token; el plan Hobby sirve para DynamoDB, S3 y Lambda en uso no comercial.

## Prueba rápida del frontend

LocalStack es opcional para la prueba visual. Para iniciar PostgreSQL, aplicar
Knex y levantar la aplicación con datos demo persistentes durante el proceso:

```bash
npm run local:dev
```

Abre `http://localhost:3000`. Para detener PostgreSQL después de cerrar Next.js:

```bash
npm run local:down
```

Crear el token en [LocalStack](https://app.localstack.cloud), exportarlo y arrancar:

```bash
export LOCALSTACK_AUTH_TOKEN='...'
npm run local:aws:up
```

El hook idempotente escribe los identificadores y variables resultantes en `.localstack/app-finances.env`. Para validar el entorno:

```bash
npm run local:aws:smoke
```

Aplicar las migraciones con Knex y después iniciar el frontend en modo demo:

```bash
set -a
source .localstack/app-finances.env
set +a
npm run db:migrate
npm run dev
```

Para detener los contenedores preservando los datos de PostgreSQL:

```bash
docker compose -f docker-compose.local.yml down
```

Para borrar también la base local:

```bash
docker compose -f docker-compose.local.yml down -v
```

## Cognito opcional

Cognito User Pools no está incluido en el plan Hobby. Con un plan Base, Ultimate, Enterprise o Student compatible puede habilitarse así:

```bash
export LOCALSTACK_AUTH_TOKEN='...'
export LOCALSTACK_ENABLE_COGNITO=true
export LOCALSTACK_SERVICES='cognito-idp,dynamodb,s3,lambda,iam,sts'
bash scripts/localstack-up.sh
bash scripts/localstack-smoke.sh
```

El backend de autenticación reconoce `AUTH_COGNITO_ENDPOINT_URL=http://localhost:4566`, por lo que sus llamadas directas pueden llegar al emulador. El usuario inicial es `admin@app-finances.local` con contraseña `LocalPass123!`; ambos valores pueden sobreescribirse antes de arrancar.

## Límites deliberados

- El frontend se ejecuta con `DEV_AUTH_BYPASS=true` y su transporte demo. LocalStack no se convierte automáticamente en el backend GraphQL de la aplicación.
- AppSync solo está disponible en planes Ultimate, Enterprise y Student. Aunque LocalStack implementa AppSync, el stack CDK de producción no se despliega en este Compose ni se ha afirmado equivalencia con AWS.
- Aurora no se emula aquí. PostgreSQL 16 es el sustituto local y se accede mediante `DATABASE_URL`.
- RDS/RDS Data API requiere como mínimo un plan Base y no aporta valor al flujo local que ya accede directamente a PostgreSQL.
- La Lambda PDF actual es un placeholder que lanza un error intencional; el servicio Lambda está habilitado para desarrollo futuro, pero no se provisiona una función engañosa.
- `PERSISTENCE=0` es el valor predeterminado porque la persistencia de LocalStack no está disponible en Hobby. Los recursos AWS se recrean mediante el hook; PostgreSQL sí usa un volumen Docker.

La matriz vigente de servicios y planes está publicada en [LocalStack Plans](https://docs.localstack.cloud/aws/licensing/). La documentación oficial de [AppSync](https://docs.localstack.cloud/aws/services/appsync/) confirma los tipos de data source soportados, pero eso no sustituye una prueba de compatibilidad del stack de producción.

# App Finances MVP

MVP web para generar y administrar invoices de tu compañía, usando:

- Next.js (App Router + TypeScript)
- shadcn/ui
- NextAuth (login por credenciales)
- Prisma + SQLite

También incluye vista de impresión para exportar PDF con estructura inspirada en `templates/Invoice_361.pdf`.

## Funcionalidades MVP

- Login protegido (`/login`)
- Lista de invoices (`/invoices`)
- Crear invoice con secciones tipo crew y line items (`/invoices/new`)
- Ver detalle y actualizar status (`DRAFT`, `SENT`, `PAID`)
- Eliminar invoice
- Vista de impresión/PDF (`/invoices/[id]/print`)

## Estructura principal

- `src/auth.ts`: configuración de NextAuth
- `src/actions/invoices.ts`: server actions de invoices
- `src/components/invoices/invoice-preview.tsx`: plantilla visual del invoice
- `prisma/schema.prisma`: modelo de datos
- `prisma/seed.ts`: creación de usuario admin inicial

## Variables de entorno

Copia `.env.example` a `.env` y ajusta valores:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace_with_a_strong_random_secret"
AUTH_URL="http://localhost:3000"

ADMIN_NAME="Admin"
ADMIN_EMAIL="admin@lightningservices.com"
ADMIN_PASSWORD="ChangeMe123!"
```

## Arranque local

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Credenciales iniciales (seed por defecto):

- Email: `admin@lightningservices.com`
- Password: `ChangeMe123!`

## Scripts

- `npm run dev`: entorno local
- `npm run lint`: lint
- `npm run build`: build producción
- `npm run prisma:generate`: generar cliente Prisma
- `npm run db:push`: sincronizar schema en DB
- `npm run db:seed`: crear/actualizar usuario admin

## Deploy en AWS

### Opción recomendada MVP: App Runner o ECS con Docker

1. Construir imagen:

```bash
docker build -t app-finances-mvp .
```

2. Publicar imagen en ECR.
3. Crear servicio en App Runner o ECS usando esa imagen.
4. Configurar variables de entorno (`DATABASE_URL`, `AUTH_SECRET`, etc.).

Nota para SQLite en producción:

- SQLite guarda un archivo local. En AWS conviene usar un volumen persistente (EFS) o migrar a RDS (PostgreSQL) para ambientes multi-instancia.

## Próximos pasos sugeridos

- Editar invoices existentes
- Módulo de clientes
- Numeración automática bloqueada por año/serie
- Envío por email de invoice generado
- Migración a PostgreSQL para producción

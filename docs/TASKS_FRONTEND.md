# Tareas Frontend

## En curso

- [x] Definir IA de navegación para módulos: Cuenta, Clientes, Configuración de pagos.
- [x] Mostrar la cuenta activa desde la membresía validada por AppSync.

## Próximas

- [x] Pantalla de onboarding de cuenta (`SELF_EMPLOYED` o `COMPANY`).
- [x] Pantalla de perfil de cuenta (datos fiscales y contacto).
- [x] Pantalla de membresía y rol del usuario actual.
- [x] CRUD de clientes con búsqueda.
- [x] Formulario de datos bancarios con campos enmascarados.
- [x] Conectar invoices a cliente y cuenta activa.
- [x] Mensajes de error de autorización y validación en formularios.
- [x] Estados vacíos para nuevos módulos.

## Calidad UX

- [x] Validaciones de formularios con `zod` y mensajes en español (errores por campo, valores conservados tras un error).
- [x] Pruebas de integración de flujos principales (crear cuenta, crear cliente, guardar banco, crear factura) con Playwright: `npm run test:e2e`.
- [x] Revisión responsive en desktop y mobile (sin desplazamiento lateral a 390px en 17 rutas, verificado en `e2e/responsive.spec.ts`).

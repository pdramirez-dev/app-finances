# App Finances Brand Kit

## Brand Intent
- Producto financiero-operativo para equipos de campo.
- Tono visual: confiable, técnico y ágil.

## Logo
- Monograma: `AF` en bloque cuadrado con borde.
- Wordmark: `App Finances` en uppercase con tracking amplio.
- Componente reusable: `src/components/brand/brand-mark.tsx`.

## Typography
- Base UI: `Geist` (`--font-geist-sans`).
- Display/Headings: `Space Grotesk` (`--font-space-grotesk`).
- Clase utilitaria para titulares: `brand-heading`.

## Color System
- `--brand-ink`: `#0a1226` (fondo principal).
- `--brand-steel`: `#14233f` (superficies oscuras).
- `--brand-cyan`: `#23c9f5` (acento informativo).
- `--brand-amber`: `#ff8b3d` (acento de energía).
- `--brand-cloud`: `#eef5ff` (fondo claro auxiliar).

## Surfaces & Effects
- Fondo de marca: `brand-page-bg`.
- Panel de marca: `brand-panel`.
- Chip de estado/eyebrow: `brand-chip`.

## Current Coverage
- Login: `src/app/(auth)/login/page.tsx`, `src/components/auth/login-form.tsx`.
- Pricing: `src/app/pricing/page.tsx`.
- Header dashboard: `src/components/layout/dashboard-header.tsx`.
- Invoices module: listado, filtros y formularios con `brand-surface` y `brand-heading`.
- Estados globales: `src/app/not-found.tsx`, `src/app/error.tsx`.
- Primitivos UI base: `Button`, `Card`, `Table`, `Input`, `Textarea`, `Select`.

## Usage Rules
- Usar `BrandMark` en headers públicos y privados.
- Mantener CTA primario con alto contraste.
- Evitar estilos sueltos cuando exista clase/token de brand.

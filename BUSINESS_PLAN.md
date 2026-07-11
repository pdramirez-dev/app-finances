    # Business Plan - App Finances

## 1. Resumen ejecutivo

App Finances es una app web SaaS para generar y gestionar invoices de empresas de servicios en campo (cuadrillas, contratistas, crews) con una estructura de factura operativa y repetible.

El objetivo es resolver tres problemas concretos:
- Facturacion manual lenta.
- Errores en montos por secciones de trabajo.
- Bajo control del estado de cobro.

El MVP actual cubre:
- Login seguro.
- Gestion de invoices (crear, listar, ver, imprimir/PDF).
- Estructura por secciones tipo crew y line items.

## 2. Problema

El publico objetivo pierde tiempo y dinero por:
- Uso de plantillas sueltas (Excel/PDF) sin trazabilidad.
- Falta de estandar en los reportes de cobro.
- Seguimiento manual de invoices enviadas y pagadas.

Consecuencias:
- Ciclos de cobro mas lentos.
- Errores de facturacion.
- Menor visibilidad del flujo de caja.

## 3. Propuesta de valor

App Finances ofrece:
- Creacion rapida de invoices con estructura fija.
- Plantilla profesional lista para imprimir/exportar.
- Estado de invoice (Draft, Sent, Paid) y control operativo.
- Flujo simple para equipos pequenos.

Diferencial inicial:
- Enfoque vertical en operaciones de campo (no solo contabilidad general).
- Formato de invoice adaptable a tu estructura real de trabajo.

## 4. Cliente objetivo

### ICP principal
- Empresas pequenas y medianas de servicios tecnicos en campo.
- Equipos de 2 a 30 personas.
- Necesidad recurrente de facturacion semanal/quincenal.

### Segmentos iniciales
- Contratistas de instalacion/mantenimiento.
- Cuadrillas electricas y de construccion ligera.
- Empresas de staffing tecnico por proyecto.

## 5. Producto y alcance

### Estado actual (MVP)
- Login.
- CRUD base de invoices.
- Vista de impresion/PDF.

### Siguiente alcance (v1)
- Edicion de invoices existentes.
- Modulo de clientes.
- Numeracion automatica por serie.
- Envio por email.
- Recordatorios de pago.

### v2
- Integraciones de cobro (Stripe).
- Dashboard financiero basico (aging, pendientes, cobrado).
- Roles y permisos avanzados.

## 6. Modelo de ingresos

### Planes de suscripcion (USD)
- Starter: $19/mes (1 usuario, hasta 40 invoices/mes).
- Pro: $49/mes (3 usuarios, invoices ilimitadas).
- Team: $99/mes (10 usuarios, roles, exportaciones avanzadas).

### Add-ons
- Usuario extra: +$8/mes.
- Onboarding inicial: $199 pago unico.
- White-label: +$79/mes.

### Fee transaccional (fase de pagos)
- 0.7% por invoice cobrada en la plataforma (adicional al procesador de pago).
- Cap de $15 por transaccion.

## 7. Estrategia go-to-market

### Canal 1: Venta directa founder-led
- Contacto directo con 20-30 empresas del nicho.
- Demo de 20 minutos con caso real.
- Prueba gratis 14 dias.

### Canal 2: Partnerships
- Alianzas con contadores/despachos pequenos.
- Plan de referidos con comision por cliente activo.

### Canal 3: Contenido de nicho
- Casos practicos: "como reducir errores en invoices de crew".
- Landing pages por vertical (electricistas, contratistas, etc.).

## 8. Operacion

### Equipo minimo
- 1 Founder product/comercial.
- 1 Developer full stack (puede ser el founder en etapa inicial).
- 1 Soporte part-time desde mes 6.

### Infraestructura
- Next.js en AWS (App Runner/ECS).
- Base inicial SQLite para MVP; migracion a PostgreSQL para escala.
- Backups y monitoreo basicos desde fase temprana.

## 9. Proyeccion financiera (12 meses, escenario base)

Supuestos:
- Ticket promedio mensual (ARPU): $41.
- Churn mensual: 4-6%.
- CAC inicial: $120-$220.
- Margen bruto SaaS alto (infraestructura baja en fase inicial).

Meta de clientes pagos:
- Mes 3: 10 clientes.
- Mes 6: 30 clientes.
- Mes 12: 80 clientes.

MRR estimado:
- Mes 3: ~$410.
- Mes 6: ~$1,230.
- Mes 12: ~$3,280.

Nota: estas cifras son un baseline para validar, no una proyeccion contable cerrada.

## 10. KPIs clave

- MRR y crecimiento mensual.
- Activacion: % de cuentas que crean su primera invoice en 48h.
- Tiempo a valor: minutos desde login hasta primer PDF.
- Churn mensual por plan.
- Expansion revenue (upgrades + add-ons).
- DSO promedio (dias de cobro) cuando se habiliten pagos.

## 11. Riesgos y mitigacion

Riesgo 1: competencia fuerte en facturacion general.
- Mitigacion: nicho vertical + workflow especializado.

Riesgo 2: baja retencion por feature gap.
- Mitigacion: roadmap enfocado en modulos de uso diario (clientes, recordatorios, cobros).

Riesgo 3: stack MVP no ideal para escala (SQLite).
- Mitigacion: plan de migracion a PostgreSQL antes de multi-tenant masivo.

Riesgo 4: ventas lentas al inicio.
- Mitigacion: venta consultiva con demos y onboarding guiado.

## 12. Roadmap de ejecucion (90 dias)

### Dia 0-30
- Cerrar MVP estable.
- Lanzar pricing y landing publica.
- Onboard primeros 5 clientes piloto.

### Dia 31-60
- Implementar edicion de invoices y modulo clientes.
- Instrumentar analytics de uso.
- Definir flujo comercial repetible.

### Dia 61-90
- Activar recordatorios de pago.
- Mejorar conversion trial->paid.
- Llegar a 10-15 clientes pagos.

## 13. Objetivo anual

Construir un producto vertical de facturacion para equipos de campo con:
- PMF inicial validado (retencion > 85% en cohortes tempranas).
- Base de 80+ clientes pagos.
- Fundamentos para escalar ventas y producto en el segundo ano.

# Modelo de Costos - App Finances

## 1. Objetivo del modelo

Este documento define un modelo de costos operativo para el MVP SaaS de App Finances.
No es una cotizacion contable; es una base para toma de decisiones y control mensual.

## 2. Supuestos base

- Moneda: USD.
- ARPU objetivo: $41/cliente/mes (mix estimado de planes + add-ons).
- Costo variable por cliente activo: $4/mes.
- Horizonte: 12 meses.
- Crecimiento esperado de clientes pagos (escenario base):
  - Mes 1 a 12: 5, 8, 12, 16, 22, 30, 40, 52, 65, 80, 95, 110.

## 3. Estructura de costos

### 3.1 Infraestructura (AWS) por etapa

Estimacion operativa mensual (valores objetivo para control interno):

| Etapa | Clientes pagos | Costo infra mensual |
|---|---:|---:|
| Pilot | 1-30 | $120 |
| Growth | 31-100 | $220 |
| Scale | 101-300 | $350 |

Distribucion tipica de estos costos:
- Compute app (App Runner/ECS Fargate).
- Base de datos (RDS PostgreSQL cuando migres desde SQLite).
- Storage/logs/email (S3 + CloudWatch + SES).
- Seguridad y red (WAF/DNS/SSL, segun etapa).

### 3.2 Costo variable por cliente

Costo variable estimado: $4 por cliente activo al mes.

Composicion de referencia:
- Email transaccional + notificaciones: $0.50
- Storage incremental + transferencia: $0.50
- Soporte operativo incremental: $3.00

## 4. OPEX no infraestructura

## Escenario A: Bootstrap (sin sueldo founder al inicio)

| Periodo | Marketing y ventas | Herramientas | Legal/contable | Soporte/contingencia | OPEX mensual |
|---|---:|---:|---:|---:|---:|
| Mes 1-6 | $400 | $150 | $150 | $200 | $900 |
| Mes 7-12 | $700 | $200 | $150 | $250 | $1,300 |

## Escenario B: Con sueldos

| Periodo | Sueldo founder | Soporte part-time | Marketing | Herramientas | Legal/contable | OPEX mensual |
|---|---:|---:|---:|---:|---:|---:|
| Mes 1-6 | $3,000 | $0 | $500 | $100 | $200 | $3,800 |
| Mes 7-12 | $3,000 | $800 | $1,000 | $100 | $200 | $5,100 |

## 5. Unit economics

Formula de contribucion por cliente:

`Contribucion = ARPU - Costo variable = 41 - 4 = $37`

Margen bruto unitario aproximado:

`37 / 41 = 90.2%`

## 6. Punto de equilibrio (break-even)

Formula:

`Clientes break-even = Costos fijos mensuales / 37`

### Escenario A (Bootstrap)

- Etapa Pilot: costos fijos = 120 + 900 = $1,020 -> 28 clientes.
- Etapa Growth: costos fijos = 220 + 1,300 = $1,520 -> 42 clientes.
- Etapa Scale: costos fijos = 350 + 1,300 = $1,650 -> 45 clientes.

### Escenario B (Con sueldos)

- Etapa Pilot: costos fijos = 120 + 3,800 = $3,920 -> 106 clientes.
- Etapa Growth: costos fijos = 220 + 5,100 = $5,320 -> 144 clientes.
- Etapa Scale: costos fijos = 350 + 5,100 = $5,450 -> 148 clientes.

## 7. Proyeccion 12 meses (escenario base de clientes)

### 7.1 Resultado mensual - Escenario A (Bootstrap)

| Mes | Clientes | MRR | Costos totales | Resultado |
|---|---:|---:|---:|---:|
| 1 | 5 | $205 | $1,040 | -$835 |
| 2 | 8 | $328 | $1,052 | -$724 |
| 3 | 12 | $492 | $1,068 | -$576 |
| 4 | 16 | $656 | $1,084 | -$428 |
| 5 | 22 | $902 | $1,108 | -$206 |
| 6 | 30 | $1,230 | $1,140 | $90 |
| 7 | 40 | $1,640 | $1,680 | -$40 |
| 8 | 52 | $2,132 | $1,728 | $404 |
| 9 | 65 | $2,665 | $1,780 | $885 |
| 10 | 80 | $3,280 | $1,970 | $1,310 |
| 11 | 95 | $3,895 | $2,030 | $1,865 |
| 12 | 110 | $4,510 | $2,090 | $2,420 |

Resumen anual escenario A:
- Revenue anual: $21,935
- Costos variables anuales: $2,140
- Infra anual: $2,430
- OPEX anual: $13,200
- Resultado operativo anual: $4,165

### 7.2 Resultado mensual - Escenario B (Con sueldos)

| Mes | Clientes | MRR | Costos totales | Resultado |
|---|---:|---:|---:|---:|
| 1 | 5 | $205 | $3,940 | -$3,735 |
| 2 | 8 | $328 | $3,952 | -$3,624 |
| 3 | 12 | $492 | $3,968 | -$3,476 |
| 4 | 16 | $656 | $3,984 | -$3,328 |
| 5 | 22 | $902 | $4,008 | -$3,106 |
| 6 | 30 | $1,230 | $4,040 | -$2,810 |
| 7 | 40 | $1,640 | $5,480 | -$3,840 |
| 8 | 52 | $2,132 | $5,528 | -$3,396 |
| 9 | 65 | $2,665 | $5,580 | -$2,915 |
| 10 | 80 | $3,280 | $5,770 | -$2,490 |
| 11 | 95 | $3,895 | $5,830 | -$1,935 |
| 12 | 110 | $4,510 | $5,890 | -$1,380 |

Resumen anual escenario B:
- Revenue anual: $21,935
- Costos variables anuales: $2,140
- Infra anual: $2,430
- OPEX anual: $53,400
- Resultado operativo anual: -$36,035

## 8. Implicaciones financieras

- El modelo bootstrap puede cerrar el ano en positivo con disciplina de gasto.
- Si incluyes sueldos completos desde el inicio, necesitas:
  - Mayor volumen (145-150 clientes pagos), o
  - Mayor ARPU, o
  - Reduccion de OPEX fijo en los primeros 6-9 meses.

## 9. Recomendacion de control de costos

1. Operar modo bootstrap hasta 40-50 clientes pagos.
2. Migrar a RDS PostgreSQL entre 30 y 50 clientes para reducir riesgo operativo.
3. Mantener CAC recuperable en <= 3 meses de margen de contribucion.
4. Revisar pricing cada trimestre; objetivo ARPU >= $45 antes de contratar equipo fijo completo.
5. Definir presupuesto tope mensual por canal de marketing y cortar canales con payback > 4 meses.

## 10. KPIs de seguimiento mensual

- MRR neto y crecimiento mensual.
- ARPU real vs objetivo ($41).
- Costo variable real por cliente.
- Margen bruto unitario.
- Clientes activos y churn.
- Burn rate mensual.
- Runway (meses de caja).


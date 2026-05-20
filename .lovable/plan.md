## Resumen
Construir un módulo de Reportes con historial diario persistente, snapshot automático a las 23:59, KPIs, gráficas, filtros y exportación PDF/Excel.

## 1. Base de datos (migración)

**Tabla `reportes_diarios`**
- `id uuid pk`, `fecha date unique not null`
- `total_tickets, pendientes, en_revision, en_proceso, finalizados, criticos int`
- `prioridad_baja, prioridad_media, prioridad_alta, prioridad_critica int`
- `tickets_creados, tickets_finalizados int`
- `tiempo_promedio_resolucion_horas numeric`
- `tickets_por_tecnico jsonb` — `[{ email, nombre, total, finalizados }]`
- `tickets_por_empresa jsonb` — `[{ company_id, nombre, total }]`
- `created_at timestamptz default now()`
- RLS: SELECT para supervisor; INSERT/UPDATE solo service_role (edge function).

**Función `generar_snapshot_diario(fecha_objetivo date)`**
- Calcula agregados desde `entradas` (+ join `profiles`/`companies` para nombres).
- `INSERT ... ON CONFLICT (fecha) DO UPDATE` para permitir re-ejecución del mismo día sin duplicar.
- Días anteriores cerrados no se sobrescriben (la edge function solo invoca para "ayer" / "hoy").

## 2. Edge function `snapshot-reportes`
- Sin auth (cron) — verify_jwt = false.
- Llama `generar_snapshot_diario(current_date - 1)` (cierra el día anterior) y `current_date` (snapshot vivo del día).
- Devuelve JSON con resultado.

**Cron pg_cron**: ejecuta diariamente 23:59 hora del servidor invocando la edge function vía `net.http_post`.

## 3. Frontend `src/pages/Reportes.tsx` (reescritura)

**Filtros**: Hoy / 7 días / 30 días / Mes actual / Año actual / Rango personalizado.

**KPIs (tarjetas)**:
- Tickets totales del periodo
- Finalizados / Tasa de resolución
- Tiempo promedio de resolución (h)
- Críticos abiertos
- Técnico con más tickets
- Empresa con más incidencias
- % SLA cumplido (definido como resueltos dentro de X horas según prioridad)

**Gráficas (recharts)**:
- Línea: tickets creados vs finalizados por día
- Barras apiladas: estados por día
- Barras horizontales: carga por técnico (del último snapshot)
- Área: tendencia semanal
- Donut: distribución por prioridad / severidad

**Datos**:
- Hook `useReportesDiarios(rango)` → consulta `reportes_diarios` por rango.
- Dashboard sigue usando `entradas` en tiempo real (sin cambios).

**Exportación**:
- Excel: `xlsx` (SheetJS) — hoja por KPI + datos crudos.
- PDF: `jspdf` + `jspdf-autotable` con tablas y captura de KPIs.

## 4. Diseño
- Dark NOC coherente con el resto (tokens semánticos de `index.css`).
- Tarjetas KPI con barra superior por severidad (reusar `StatCard`).
- Gráficas con colores `--status-*` y `--priority-*`.
- Responsive grid 1/2/4 columnas.

## Archivos
- Migración SQL (tabla + función + RLS + cron job)
- `supabase/functions/snapshot-reportes/index.ts` (+ entrada en `config.toml`)
- `src/hooks/useReportesDiarios.tsx`
- `src/lib/reportesExport.ts` (PDF + Excel)
- `src/pages/Reportes.tsx` (reescritura)
- `package.json`: añadir `xlsx`, `jspdf`, `jspdf-autotable`

## Notas técnicas
- "Mantener historial aunque se eliminen tickets" se logra porque `reportes_diarios` guarda agregados — eliminar tickets no afecta filas pasadas.
- SLA por defecto: crítica ≤4h, alta ≤8h, media ≤24h, baja ≤72h (ajustable).
- El snapshot del día actual se actualiza (upsert) en cada corrida; días pasados solo se generan una vez al cierre.

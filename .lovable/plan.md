## Plan: Módulo "Órdenes de trabajo"

Crear un módulo paralelo a Tickets para gestionar tareas internas (mantenimientos, instalaciones, visitas, configuraciones), reutilizando componentes existentes mediante una capa genérica.

---

### 1. Base de datos (migración)

**Tabla `ordenes_trabajo`** — misma estructura que `entradas` + campos específicos:
- `id`, `user_id`, `company_id` (uuid, opcional para asociar empresa explícita)
- `title`, `description`, `observations`
- `priority` (`baja`/`media`/`alta`/`critica`)
- `status` (`pendiente`/`en_revision`/`en_proceso`/`finalizado`/`cancelado`)
- `assigned_technician` (email)
- `tipo` (`mantenimiento`/`instalacion`/`visita`/`configuracion`/`otro`)
- `evidencias` (jsonb array de URLs)
- `fecha_inicio_revision`, `fecha_finalizacion`
- `tiempo_resolucion_segundos`, `tiempo_resolucion_texto`
- `visto_por_tecnico`, `visto_por_supervisor`
- `created_at`, `updated_at`

**Tabla `historial_ordenes`** — espejo de `ticket_history` con `orden_id`.

**Configuración por empresa**: campo `puede_crear_ordenes boolean default false` en `companies` para habilitar creación por cliente.

**Triggers reutilizados**:
- `ordenes_cronometro` (clon de `entradas_cronometro`)
- `log_orden_changes` (clon de `log_entrada_changes`)
- `reset_visto_orden_on_assign`
- `set_updated_at`

**RLS** (idéntica a `entradas`):
- Cliente: ve sus propias órdenes; inserta solo si `companies.puede_crear_ordenes = true`
- Técnico: ve/edita órdenes donde `assigned_technician = email`
- Supervisor: control total

**Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE ordenes_trabajo`.

**Bucket storage** `ordenes-evidencias` (privado) con políticas: técnico/supervisor/cliente dueño pueden leer; técnico/supervisor pueden subir.

---

### 2. Refactor a componentes genéricos reutilizables

Para no duplicar la UI, generalizo lo existente:

- **`src/lib/workItems.ts`** — tipo `WorkItem` común + helpers (`formatDuracion`, badges, status/priority maps) que ya existen en `tickets.ts`. `tickets.ts` re-exporta desde aquí para no romper imports.
- **`src/components/WorkItemsTable.tsx`** — versión genérica de `TicketsTable` parametrizada por: labels, callbacks, columnas extra opcionales (p. ej. "Tipo" para órdenes). `TicketsTable` pasa a ser un wrapper delgado.
- **`src/components/WorkItemDialog.tsx`** — versión genérica de `TicketDialog` con prop `extraFields` para el selector de **tipo** y subida de **evidencias**. `TicketDialog` queda como wrapper.
- **`src/hooks/useRealtimeTable.tsx`** — generaliza `useRealtimeEntradas(tabla)`. `useRealtimeEntradas` lo usa internamente.
- **`src/hooks/useUnseenWorkItems.tsx`** — versión genérica de `useUnseenTickets`/`useUnseenSupervisor` parametrizada por tabla.

---

### 3. Páginas y rutas

- **`src/pages/Ordenes.tsx`** — equivalente a `Tickets.tsx`, consume `ordenes_trabajo`, usa los componentes genéricos.
- **`src/App.tsx`** — añadir ruta `/ordenes`.
- **`src/components/AppSidebar.tsx`** — nuevo item "Órdenes de trabajo" (ícono `ClipboardList`) entre Tickets y Técnicos, con badge de no vistos propio.

---

### 4. Dashboard

En `src/pages/Dashboard.tsx` agregar 3 tarjetas para supervisor/técnico:
- OT pendientes
- OT en revisión
- OT finalizadas

(Carga paralela con `ordenes_trabajo`.)

---

### 5. Reportes

`src/pages/Reportes.tsx` gana un **tab/switch** "Tickets" ↔ "Órdenes de trabajo" reutilizando la misma vista, cambiando solo la fuente de datos (`entradas` vs `ordenes_trabajo`).

---

### Detalles técnicos

- Permisos cliente para crear OT: chequeo en RLS mediante función `puede_crear_ordenes(_user_id)` que consulta `profiles.company_id → companies.puede_crear_ordenes`.
- Estado `cancelado` añade nueva badge gris en `TicketBadges.tsx`.
- Evidencias: input file múltiple en el dialog, sube a `ordenes-evidencias/{orden_id}/...`, guarda URLs en `evidencias jsonb`.
- Cronómetro y `format_duracion` SQL ya existen y se reutilizan.

---

### Archivos a crear/editar

**Crear**
- migración `ordenes_trabajo.sql`
- `src/pages/Ordenes.tsx`
- `src/components/WorkItemsTable.tsx`, `WorkItemDialog.tsx`
- `src/lib/workItems.ts`
- `src/hooks/useRealtimeTable.tsx`, `useUnseenWorkItems.tsx`, `useOrdenes.tsx` (si necesario)

**Editar**
- `src/App.tsx`, `src/components/AppSidebar.tsx`
- `src/components/TicketsTable.tsx`, `TicketDialog.tsx` (wrappers)
- `src/components/TicketBadges.tsx` (estado cancelado)
- `src/hooks/useRealtimeEntradas.tsx`
- `src/pages/Dashboard.tsx`, `src/pages/Reportes.tsx`
- `src/lib/tickets.ts` (re-export)

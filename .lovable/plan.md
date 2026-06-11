# Migración definitiva a PostgreSQL + Backend propio

## Estrategia general

El frontend usa el cliente `supabase` en **23 archivos** (.from / .auth / .channel / .storage / .functions.invoke). Reescribir cada archivo rompería el preview y multiplicaría el riesgo. La estrategia recomendada — y la única realista para mantener el proyecto **compilable y funcional durante toda la migración** — es:

1. **Reemplazar `src/integrations/supabase/client.ts` por un shim de compatibilidad** que expone la misma API superficial (`.from().select().eq()...`, `.auth.*`, `.channel().on().subscribe()`, `.storage.from()...`, `.functions.invoke()`) pero internamente llama al backend Node/Express + Socket.IO.
2. **Eliminar la dependencia `@supabase/supabase-js`** del `package.json`.
3. **Borrar carpeta `supabase/`** (Edge Functions, config, migrations) y `src/integrations/supabase/types.ts`.
4. **Backend Node/Express** (ya generado en `/mnt/documents/backend`) se vuelca al repo en `/backend` y se completa con los endpoints faltantes que el shim necesita (CRUD genérico whitelisted por tabla, storage, notificaciones, reportes, history).
5. **PostgreSQL puro**: usar el schema ya generado (`helpdesk_schema_pg12.sql`) + `seed.sql` con supervisor inicial. Migraciones gestionadas por `backend/src/lib/migrate.js`.

Con este enfoque ningún componente de UI cambia. Solo cambia la capa de comunicación.

## Fases

### Fase A — Backend (completar lo ya generado)
- Volcar `/mnt/documents/backend` → `/backend` del repo.
- Añadir rutas faltantes:
  - `GET/POST/PATCH/DELETE /api/db/:table` — CRUD genérico con filtros `?eq.col=val` y proyección `?select=` (whitelist de tablas).
  - `POST /api/rpc/:fn` — para `has_role`, `puede_crear_ordenes`, `generar_snapshot_diario`.
  - `POST /api/storage/:bucket/upload` y `GET /api/storage/:bucket/sign` (X-Accel-Redirect).
  - `POST /api/admin/resolve-username`, `POST /api/admin/create-company`, `POST /api/admin/create-user`, `POST /api/admin/update-user`.
- Socket.IO emite eventos `table:entradas`, `table:ordenes_trabajo`, `table:notifications`, etc., con `{event, schema, table, new, old}` (formato Supabase Realtime).
- Migraciones: `001_schema.sql` (volcar `helpdesk_schema_pg12.sql`) + `002_seed_supervisor.sql`.

### Fase B — Shim de compatibilidad en frontend
- Reescribir `src/integrations/supabase/client.ts` como shim que mantiene la interfaz pública. Soporta:
  - `auth.signInWithPassword`, `auth.signOut`, `auth.getSession`, `auth.getUser`, `auth.onAuthStateChange` → cookies HttpOnly + `/api/auth/*`.
  - `from(t).select/insert/update/delete/eq/ilike/in/order/limit/maybeSingle/single` → `/api/db/:table`.
  - `channel(name).on('postgres_changes', filter, cb).subscribe()` y `removeChannel()` → Socket.IO.
  - `storage.from(b).upload/createSignedUrl/remove` → `/api/storage/:bucket/*`.
  - `functions.invoke(name, {body})` → `/api/admin/<name>` (mapeo directo).
  - `rpc(fn, args)` → `/api/rpc/:fn`.
- Mantiene `Database` types como `any` (sin Supabase types).

### Fase C — Limpieza
- `bun remove @supabase/supabase-js`.
- Borrar `supabase/` (config + edge functions).
- Borrar `src/integrations/supabase/types.ts` (reemplazar por `types.ts` mínimo con `Database = any`).
- Quitar `VITE_SUPABASE_*` del `.env`, añadir `VITE_API_URL` y `VITE_SOCKET_URL`.
- Eliminar buckets Supabase desde el panel (manual, fuera de código).

### Fase D — Verificación
- `npm run build` debe pasar.
- Login con supervisor seed.
- Smoke test de creación de ticket → notificación realtime.

## Detalles técnicos clave

**Shim auth/session**: la sesión se mantiene server-side vía cookie HttpOnly `hd_session`. `getUser()` hace `GET /api/auth/me`. `onAuthStateChange` se dispara local tras login/logout.

**Shim query builder**: implementación mínima de un builder encadenable que acumula `{filters, select, order, limit, single}` y al hacer `await` (then-able) ejecuta `fetch('/api/db/:table?...')`. Devuelve `{data, error, count}` igual que Supabase.

**Realtime**: cliente Socket.IO único; `channel().on()` registra listener filtrado por `table` y reenvía payload `{eventType, new, old}` al callback con shape Supabase.

**Storage**: `upload` → multipart POST; `createSignedUrl` → endpoint que firma JWT corto y devuelve URL `/api/files/<bucket>/<path>?t=<jwt>` que Nginx sirve vía X-Accel-Redirect.

## Entregables finales
1. `/backend` completo en el repo con migrations, seed, README.
2. `src/integrations/supabase/client.ts` reemplazado por shim (~400 líneas).
3. `package.json` sin `@supabase/*`.
4. `.env` con nuevas variables.
5. `INFORME_MIGRACION_FINAL.md` con: archivos modificados, dependencias eliminadas/instaladas, variables, despliegue, validación.

## Riesgos y notas
- **Buckets Supabase**: los archivos ya subidos a Supabase Storage **no se migran automáticamente**. El usuario debe descargarlos y volcarlos a `/opt/helpdesk/uploads/<bucket>/...` (script de migración opcional, no incluido por defecto).
- **`auth.users`**: el seed crea un supervisor en `usuarios` con bcrypt. Los `profiles` existentes con `id = auth.users.id` quedarán huérfanos; el seed reasigna o recrea según `correo`.
- **Edge Functions** (`snapshot-reportes` cron): se reemplaza por endpoint `POST /api/admin/snapshot-reportes` invocable por cron de sistema (`crontab`).

## Confirmación
¿Procedo con las cuatro fases en un solo turno (entrega completa, ~10-15 archivos nuevos/modificados en frontend + backend volcado en repo)? El proyecto quedará compilable al final del turno, pero requiere que el backend Node esté corriendo en `http://localhost:3001` para funcionar en runtime.

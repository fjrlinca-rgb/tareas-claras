# HelpDesk Backend — Despliegue (Fase 1)

Stack: **Node.js 20 + Express + PostgreSQL 17 + Socket.IO + Nginx + PM2**.
Sin Supabase. JWT en **cookie HttpOnly** (Secure + SameSite=Lax). Uploads servidos por **Nginx vía `X-Accel-Redirect`**.

> Decisiones confirmadas por el usuario:
> - Realtime: **Socket.IO**
> - Archivos: **Nginx `X-Accel-Redirect`** (no streaming desde Node)
> - Auth: **JWT en cookie HttpOnly** (sin `localStorage`)
> - Bootstrap: `seed.sql` con supervisor inicial
> - Procesos: **PM2 + pm2-logrotate**

---

## 1. Estructura

```
/opt/helpdesk/
├── backend/                 # este paquete
│   ├── src/...
│   ├── sql/seed.sql
│   ├── ecosystem.config.cjs # PM2
│   ├── nginx.helpdesk.conf  # plantilla Nginx
│   ├── .env                 # copiar de .env.example
│   └── package.json
├── frontend/dist/           # build de Vite (Fase 3)
└── uploads/                 # archivos subidos (chown helpdesk:helpdesk)
```

## 2. Pasos en el servidor

```bash
# 2.1 Usuario y carpetas
sudo useradd -r -m -d /opt/helpdesk -s /bin/bash helpdesk
sudo mkdir -p /opt/helpdesk/{backend,frontend,uploads} /var/log/helpdesk
sudo chown -R helpdesk:helpdesk /opt/helpdesk /var/log/helpdesk

# 2.2 PostgreSQL — base + usuario de aplicación
sudo -u postgres psql <<'SQL'
CREATE DATABASE helpdesk;
CREATE USER helpdesk_app WITH PASSWORD 'CAMBIA_ESTA_PASSWORD';
GRANT CONNECT ON DATABASE helpdesk TO helpdesk_app;
\c helpdesk
GRANT USAGE, CREATE ON SCHEMA public TO helpdesk_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO helpdesk_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO helpdesk_app;
SQL

# 2.3 Importar esquema base y seed
sudo -u postgres psql -d helpdesk -f /ruta/a/helpdesk_schema_pg12.sql
# Genera hash bcrypt para la contraseña del supervisor y reemplázalo en seed.sql:
node -e "console.log(require('bcryptjs').hashSync('ChangeMe!123',12))"
sudo -u postgres psql -d helpdesk -f /opt/helpdesk/backend/sql/seed.sql

# 2.4 Copiar backend y dependencias
cd /opt/helpdesk/backend
cp .env.example .env       # editar y poner JWT_SECRET, DATABASE_URL, etc.
npm ci --omit=dev

# 2.4.1 Aplicar migraciones pendientes (vacío en primera instalación)
npm run migrate
npm run migrate:status

# 2.5 PM2
sudo npm i -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u helpdesk --hp /opt/helpdesk   # ejecutar lo que imprima

# 2.6 Nginx
sudo cp nginx.helpdesk.conf /etc/nginx/sites-available/helpdesk.conf
sudo ln -s /etc/nginx/sites-available/helpdesk.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 3. Documentación interactiva (Swagger / OpenAPI)

- UI: `https://helpdesk.tudominio.com/api/docs`
- Spec JSON: `https://helpdesk.tudominio.com/api/docs.json`
- Fuente: `src/lib/openapi.js` (editar y reiniciar PM2 para refrescar).
- La cookie `hd_session` se envía automáticamente desde el mismo origen; usa "Authorize" sólo si pruebas desde otro dominio.

## 4. Migraciones de base de datos

Sistema forward-only en `backend/migrations/`. Cada archivo es inmutable; se verifica su checksum SHA-256 en cada ejecución.

```bash
# crear una migración nueva
npm run migrate:create -- add_users_index

# aplicar pendientes (transacción por archivo)
npm run migrate

# ver estado (applied / PENDING)
npm run migrate:status
```

El runner mantiene la tabla `public.schema_migrations(version, checksum, applied_at)` y se autocreará la primera vez. El esquema base (`helpdesk_schema_pg12.sql`) se carga **una sola vez** en el paso 2.3; todo cambio posterior debe ir como migración.

## 5. Endpoints disponibles (Fase 1)

| Método | Ruta                              | Descripción                                     |
| ------ | --------------------------------- | ----------------------------------------------- |
| POST   | `/api/auth/login`                 | `{usuario, password}` → set-cookie + `{user}`   |
| POST   | `/api/auth/logout`                | Limpia cookie                                   |
| GET    | `/api/auth/me`                    | Usuario actual                                  |
| GET    | `/api/health`                     | Healthcheck                                     |
| GET    | `/api/:resource`                  | List (filtros `col=eq.x`, `order=col.desc`)     |
| GET    | `/api/:resource/:id`              | Detalle                                         |
| POST   | `/api/:resource`                  | Insert                                          |
| PATCH  | `/api/:resource/:id`              | Update                                          |
| DELETE | `/api/:resource/:id`              | Delete                                          |
| POST   | `/api/admin/users`                | Supervisor crea usuario                         |
| PATCH  | `/api/admin/users/:id`            | Supervisor edita usuario                        |
| DELETE | `/api/admin/users/:id`            | Supervisor elimina usuario                      |
| POST   | `/api/admin/companies`            | Supervisor crea empresa                         |
| POST   | `/api/uploads`                    | Sube archivo (multipart)                        |
| GET    | `/api/uploads/:id`                | Descarga vía X-Accel-Redirect                   |
| DELETE | `/api/uploads/:id`                | Elimina                                         |

Recursos válidos en `/api/:resource`:
`tickets`, `ordenes`, `actividades`, `technicians`, `companies`,
`notifications`, `ticket_history`, `historial_ordenes`,
`reportes_diarios`, `attachments`.

Socket.IO: namespace por defecto, ruta `/socket.io`. Eventos emitidos:
`entradas`, `ordenes_trabajo`, `actividades_tecnicas`, `notifications`
con payload `{ type: "INSERT"|"UPDATE"|"DELETE", row }`.

## 6. Validación

```bash
# Healthcheck
curl -i https://helpdesk.tudominio.com/api/health

# Login (guarda cookie)
curl -i -c /tmp/c.txt -X POST https://helpdesk.tudominio.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"usuario":"supervisor","password":"ChangeMe!123"}'

# Me
curl -i -b /tmp/c.txt https://helpdesk.tudominio.com/api/auth/me

# Swagger UI
xdg-open https://helpdesk.tudominio.com/api/docs
```


## 7. Próximas fases

- **Fase 2**: `src/lib/api.ts` (fetch wrapper con `credentials:'include'`) + cliente Socket.IO + reemplazo de `useAuth` / `useRealtimeEntradas`.
- **Fase 3**: migración archivo por archivo de los 22 componentes que importan `@/integrations/supabase/client`.
- **Fase 4**: eliminación de `@supabase/supabase-js`, `supabase/` y variables `VITE_SUPABASE_*`.

## 6. Corrección al informe

Sección 4 del informe — **descartado** `localStorage` para el JWT. La autenticación usa **cookie HttpOnly** (`hd_session`, `Secure`, `SameSite=Lax`), incluida automáticamente por el navegador en peticiones a `/api/*` y en el handshake de Socket.IO. El frontend nunca lee el token.

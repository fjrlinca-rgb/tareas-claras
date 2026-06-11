-- =====================================================================
-- Helpdesk - Esquema PostgreSQL 12 estándar (sin dependencias Supabase)
-- =====================================================================
-- Ejecutar como superusuario:
--   CREATE DATABASE helpdesk;
--   \c helpdesk
-- Luego ejecutar este archivo.
--
-- Cambios respecto al export original de Supabase:
--   - Eliminado: schema auth, auth.users, auth.uid(), auth.jwt()
--   - Eliminado: CREATE POLICY, RLS, roles authenticated/anon/service_role
--   - Eliminado: ALTER TABLE ... REPLICA IDENTITY FULL (no necesario)
--   - Reemplazo: tabla propia `usuarios` con id, usuario, nombre, correo,
--                password_hash, rol y activo.
--   - Reemplazo: funciones/triggers que usaban auth.uid()/auth.jwt() ahora
--                leen `current_setting('app.current_user_id', true)` y
--                `current_setting('app.current_user_email', true)`.
--                La aplicación debe ejecutar al inicio de cada conexión/tx:
--                  SET app.current_user_id = '<uuid>';
--                  SET app.current_user_email = '<correo>';
-- =====================================================================

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

-- Requerido para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- ENUMS
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('cliente', 'supervisor', 'tecnico');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- TABLA DE USUARIOS PROPIA (reemplaza auth.users)
-- =====================================================================

CREATE TABLE usuarios (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario       varchar(100) NOT NULL UNIQUE,
    nombre        varchar(200),
    correo        varchar(255) NOT NULL UNIQUE,
    password_hash text         NOT NULL,
    rol           varchar(50)  NOT NULL DEFAULT 'cliente',
    activo        boolean      NOT NULL DEFAULT true,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX usuarios_usuario_lower_idx ON usuarios (lower(usuario));
CREATE UNIQUE INDEX usuarios_correo_lower_idx  ON usuarios (lower(correo));

-- =====================================================================
-- HELPERS para reemplazar auth.uid() / auth.jwt()->>'email'
-- =====================================================================

CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.current_user_id', true);
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  RETURN v::uuid;
END; $$;

CREATE OR REPLACE FUNCTION current_user_email() RETURNS text
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_email', true), '');
END; $$;

-- =====================================================================
-- FUNCIONES DE UTILIDAD
-- =====================================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION format_duracion(segundos integer) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s integer := GREATEST(COALESCE(segundos, 0), 0);
  d integer; h integer; m integer;
BEGIN
  d := s / 86400;
  h := (s % 86400) / 3600;
  m := (s % 3600) / 60;
  IF d > 0 THEN RETURN d || ' d ' || h || ' h';
  ELSIF h > 0 THEN RETURN h || ' h ' || m || ' min';
  ELSE RETURN GREATEST(m, 1) || ' min';
  END IF;
END; $$;

-- =====================================================================
-- TABLAS PRINCIPALES
-- =====================================================================

CREATE TABLE companies (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    contact             text,
    email               text,
    active              boolean NOT NULL DEFAULT true,
    created_by          uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    puede_crear_ordenes boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- profiles: mantiene info adicional ligada a usuarios (1-1)
CREATE TABLE profiles (
    id         uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    email      text,
    full_name  text,
    username   text,
    company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
    active     boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX profiles_username_unique
  ON profiles (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE user_roles (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    role       app_role NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

CREATE TABLE technicians (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    email      text NOT NULL UNIQUE,
    phone      text,
    specialty  text,
    active     boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE entradas (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    title                       text NOT NULL,
    description                 text,
    priority                    text NOT NULL DEFAULT 'media'
        CHECK (priority IN ('baja','media','alta','critica')),
    status                      text NOT NULL DEFAULT 'pendiente'
        CHECK (status IN ('pendiente','en_proceso','en_revision','finalizado')),
    assigned_technician         text,
    observations                text,
    visto_por_tecnico           boolean NOT NULL DEFAULT false,
    visto_por_supervisor        boolean NOT NULL DEFAULT false,
    fecha_inicio_revision       timestamptz,
    fecha_finalizacion          timestamptz,
    tiempo_resolucion_segundos  integer,
    tiempo_resolucion_texto     text,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_user ON entradas(user_id);

CREATE TABLE ordenes_trabajo (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    company_id                  uuid REFERENCES companies(id) ON DELETE SET NULL,
    title                       text NOT NULL,
    description                 text,
    priority                    text NOT NULL DEFAULT 'media',
    status                      text NOT NULL DEFAULT 'pendiente',
    tipo                        text NOT NULL DEFAULT 'otro',
    assigned_technician         text,
    observations                text,
    evidencias                  jsonb NOT NULL DEFAULT '[]'::jsonb,
    visto_por_tecnico           boolean NOT NULL DEFAULT false,
    visto_por_supervisor        boolean NOT NULL DEFAULT false,
    fecha_inicio_revision       timestamptz,
    fecha_finalizacion          timestamptz,
    tiempo_resolucion_segundos  integer,
    tiempo_resolucion_texto     text,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE actividades_tecnicas (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tecnico_id             uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tecnico_email          text,
    titulo                 text NOT NULL,
    descripcion            text,
    tipo                   text NOT NULL DEFAULT 'otro',
    observaciones          text,
    estado                 text NOT NULL DEFAULT 'en_curso',
    fecha_inicio           timestamptz NOT NULL DEFAULT now(),
    fecha_fin              timestamptz,
    tiempo_total_segundos  integer,
    tiempo_total_texto     text,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attachments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_type       text NOT NULL CHECK (parent_type IN ('ticket','orden')),
    parent_id         uuid NOT NULL,
    bucket            text NOT NULL,
    path              text NOT NULL,
    file_name         text NOT NULL,
    mime_type         text,
    size_bytes        bigint,
    uploaded_by       uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    uploaded_by_email text,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_parent ON attachments(parent_type, parent_id);

CREATE TABLE ticket_history (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id         uuid NOT NULL REFERENCES entradas(id) ON DELETE CASCADE,
    changed_by        uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    changed_by_email  text,
    action            text NOT NULL,
    field             text,
    old_value         text,
    new_value         text,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id, created_at DESC);

CREATE TABLE historial_ordenes (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_id          uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    changed_by        uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    changed_by_email  text,
    action            text NOT NULL,
    field             text,
    old_value         text,
    new_value         text,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    kind              text NOT NULL CHECK (kind IN ('ticket','orden')),
    parent_id         uuid NOT NULL,
    title             text NOT NULL,
    technician_email  text,
    finalized_at      timestamptz NOT NULL DEFAULT now(),
    message           text NOT NULL,
    read              boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_read    ON notifications(user_id, read);

CREATE TABLE reportes_diarios (
    id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha                             date NOT NULL UNIQUE,
    total_tickets                     integer NOT NULL DEFAULT 0,
    pendientes                        integer NOT NULL DEFAULT 0,
    en_revision                       integer NOT NULL DEFAULT 0,
    en_proceso                        integer NOT NULL DEFAULT 0,
    finalizados                       integer NOT NULL DEFAULT 0,
    criticos                          integer NOT NULL DEFAULT 0,
    prioridad_baja                    integer NOT NULL DEFAULT 0,
    prioridad_media                   integer NOT NULL DEFAULT 0,
    prioridad_alta                    integer NOT NULL DEFAULT 0,
    prioridad_critica                 integer NOT NULL DEFAULT 0,
    tickets_creados                   integer NOT NULL DEFAULT 0,
    tickets_finalizados               integer NOT NULL DEFAULT 0,
    tiempo_promedio_resolucion_horas  numeric NOT NULL DEFAULT 0,
    sla_cumplido_pct                  numeric NOT NULL DEFAULT 0,
    tickets_por_tecnico               jsonb NOT NULL DEFAULT '[]'::jsonb,
    tickets_por_empresa               jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at                        timestamptz NOT NULL DEFAULT now(),
    updated_at                        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reportes_diarios_fecha ON reportes_diarios(fecha DESC);

-- =====================================================================
-- FUNCIONES DE NEGOCIO
-- =====================================================================

CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION puede_crear_ordenes(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT c.puede_crear_ordenes
       FROM profiles p
       JOIN companies c ON c.id = p.company_id
      WHERE p.id = _user_id),
    false);
$$;

CREATE OR REPLACE FUNCTION can_access_parent(_parent_type text, _parent_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT
    has_role(current_user_id(), 'supervisor'::app_role)
    OR (_parent_type = 'ticket' AND EXISTS (
          SELECT 1 FROM entradas e
          WHERE e.id = _parent_id
            AND (e.user_id = current_user_id()
                 OR (has_role(current_user_id(), 'tecnico'::app_role)
                     AND e.assigned_technician = current_user_email()))
       ))
    OR (_parent_type = 'orden' AND EXISTS (
          SELECT 1 FROM ordenes_trabajo o
          WHERE o.id = _parent_id
            AND (o.user_id = current_user_id()
                 OR (has_role(current_user_id(), 'tecnico'::app_role)
                     AND o.assigned_technician = current_user_email()))
       ))
    OR (_parent_type = 'actividad' AND EXISTS (
          SELECT 1 FROM actividades_tecnicas a
          WHERE a.id = _parent_id AND a.tecnico_id = current_user_id()
       ));
$$;

-- ---------- Cronómetros ----------

CREATE OR REPLACE FUNCTION entradas_cronometro() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('en_revision','en_proceso') AND NEW.fecha_inicio_revision IS NULL THEN
      NEW.fecha_inicio_revision := now();
    END IF;
    IF NEW.status = 'finalizado' THEN
      IF NEW.fecha_inicio_revision IS NULL THEN
        NEW.fecha_inicio_revision := COALESCE(NEW.created_at, now());
      END IF;
      NEW.fecha_finalizacion := COALESCE(NEW.fecha_finalizacion, now());
      NEW.tiempo_resolucion_segundos := GREATEST(EXTRACT(EPOCH FROM (NEW.fecha_finalizacion - NEW.fecha_inicio_revision))::int, 0);
      NEW.tiempo_resolucion_texto := format_duracion(NEW.tiempo_resolucion_segundos);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('en_revision','en_proceso')
       AND OLD.status NOT IN ('en_revision','en_proceso','finalizado')
       AND NEW.fecha_inicio_revision IS NULL THEN
      NEW.fecha_inicio_revision := now();
    END IF;
    IF NEW.status = 'finalizado' AND OLD.status <> 'finalizado' THEN
      IF NEW.fecha_inicio_revision IS NULL THEN
        NEW.fecha_inicio_revision := COALESCE(OLD.fecha_inicio_revision, OLD.created_at, now());
      END IF;
      NEW.fecha_finalizacion := now();
      NEW.tiempo_resolucion_segundos := GREATEST(EXTRACT(EPOCH FROM (NEW.fecha_finalizacion - NEW.fecha_inicio_revision))::int, 0);
      NEW.tiempo_resolucion_texto := format_duracion(NEW.tiempo_resolucion_segundos);
    END IF;
    IF OLD.status = 'finalizado' AND NEW.status <> 'finalizado' THEN
      NEW.fecha_finalizacion := NULL;
      NEW.tiempo_resolucion_segundos := NULL;
      NEW.tiempo_resolucion_texto := NULL;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION ordenes_cronometro() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('en_revision','en_proceso') AND NEW.fecha_inicio_revision IS NULL THEN
      NEW.fecha_inicio_revision := now();
    END IF;
    IF NEW.status = 'finalizado' THEN
      IF NEW.fecha_inicio_revision IS NULL THEN
        NEW.fecha_inicio_revision := COALESCE(NEW.created_at, now());
      END IF;
      NEW.fecha_finalizacion := COALESCE(NEW.fecha_finalizacion, now());
      NEW.tiempo_resolucion_segundos := GREATEST(EXTRACT(EPOCH FROM (NEW.fecha_finalizacion - NEW.fecha_inicio_revision))::int, 0);
      NEW.tiempo_resolucion_texto := format_duracion(NEW.tiempo_resolucion_segundos);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('en_revision','en_proceso')
       AND OLD.status NOT IN ('en_revision','en_proceso','finalizado')
       AND NEW.fecha_inicio_revision IS NULL THEN
      NEW.fecha_inicio_revision := now();
    END IF;
    IF NEW.status = 'finalizado' AND OLD.status <> 'finalizado' THEN
      IF NEW.fecha_inicio_revision IS NULL THEN
        NEW.fecha_inicio_revision := COALESCE(OLD.fecha_inicio_revision, OLD.created_at, now());
      END IF;
      NEW.fecha_finalizacion := now();
      NEW.tiempo_resolucion_segundos := GREATEST(EXTRACT(EPOCH FROM (NEW.fecha_finalizacion - NEW.fecha_inicio_revision))::int, 0);
      NEW.tiempo_resolucion_texto := format_duracion(NEW.tiempo_resolucion_segundos);
    END IF;
    IF OLD.status = 'finalizado' AND NEW.status <> 'finalizado' THEN
      NEW.fecha_finalizacion := NULL;
      NEW.tiempo_resolucion_segundos := NULL;
      NEW.tiempo_resolucion_texto := NULL;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION actividades_cronometro() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.fecha_inicio IS NULL THEN NEW.fecha_inicio := now(); END IF;
    IF NEW.estado = 'finalizada' THEN
      NEW.fecha_fin := COALESCE(NEW.fecha_fin, now());
      NEW.tiempo_total_segundos := GREATEST(EXTRACT(EPOCH FROM (NEW.fecha_fin - NEW.fecha_inicio))::int, 0);
      NEW.tiempo_total_texto := format_duracion(NEW.tiempo_total_segundos);
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.estado = 'finalizada' AND OLD.estado <> 'finalizada' THEN
      NEW.fecha_fin := COALESCE(NEW.fecha_fin, now());
      NEW.tiempo_total_segundos := GREATEST(EXTRACT(EPOCH FROM (NEW.fecha_fin - NEW.fecha_inicio))::int, 0);
      NEW.tiempo_total_texto := format_duracion(NEW.tiempo_total_segundos);
    END IF;
    IF OLD.estado = 'finalizada' AND NEW.estado <> 'finalizada' THEN
      NEW.fecha_fin := NULL;
      NEW.tiempo_total_segundos := NULL;
      NEW.tiempo_total_texto := NULL;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

-- ---------- Reset visto al asignar técnico ----------

CREATE OR REPLACE FUNCTION reset_visto_on_assign() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_technician IS NOT NULL THEN NEW.visto_por_tecnico := false; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.assigned_technician,'') IS DISTINCT FROM COALESCE(OLD.assigned_technician,'')
       AND NEW.assigned_technician IS NOT NULL THEN
      NEW.visto_por_tecnico := false;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION reset_visto_orden_on_assign() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_technician IS NOT NULL THEN NEW.visto_por_tecnico := false; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.assigned_technician,'') IS DISTINCT FROM COALESCE(OLD.assigned_technician,'')
       AND NEW.assigned_technician IS NOT NULL THEN
      NEW.visto_por_tecnico := false;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

-- ---------- Auditoría ----------

CREATE OR REPLACE FUNCTION log_entrada_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  uid    uuid := current_user_id();
  uemail text := current_user_email();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ticket_history (ticket_id, changed_by, changed_by_email, action, field, new_value)
    VALUES (NEW.id, uid, uemail, 'created', NULL, NEW.status);
    IF NEW.assigned_technician IS NOT NULL AND NEW.assigned_technician <> '' THEN
      INSERT INTO ticket_history (ticket_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'assigned_on_create', 'assigned_technician', NULL, NEW.assigned_technician);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO ticket_history (ticket_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'status', OLD.status, NEW.status);
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO ticket_history (ticket_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'priority', OLD.priority, NEW.priority);
    END IF;
    IF COALESCE(NEW.assigned_technician,'') IS DISTINCT FROM COALESCE(OLD.assigned_technician,'') THEN
      INSERT INTO ticket_history (ticket_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'assigned_technician', OLD.assigned_technician, NEW.assigned_technician);
    END IF;
    IF COALESCE(NEW.observations,'') IS DISTINCT FROM COALESCE(OLD.observations,'') THEN
      INSERT INTO ticket_history (ticket_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'observations', OLD.observations, NEW.observations);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION log_orden_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  uid    uuid := current_user_id();
  uemail text := current_user_email();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO historial_ordenes (orden_id, changed_by, changed_by_email, action, field, new_value)
    VALUES (NEW.id, uid, uemail, 'created', NULL, NEW.status);
    IF NEW.assigned_technician IS NOT NULL AND NEW.assigned_technician <> '' THEN
      INSERT INTO historial_ordenes (orden_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'assigned_on_create', 'assigned_technician', NULL, NEW.assigned_technician);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO historial_ordenes (orden_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'status', OLD.status, NEW.status);
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO historial_ordenes (orden_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'priority', OLD.priority, NEW.priority);
    END IF;
    IF COALESCE(NEW.assigned_technician,'') IS DISTINCT FROM COALESCE(OLD.assigned_technician,'') THEN
      INSERT INTO historial_ordenes (orden_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'assigned_technician', OLD.assigned_technician, NEW.assigned_technician);
    END IF;
    IF COALESCE(NEW.observations,'') IS DISTINCT FROM COALESCE(OLD.observations,'') THEN
      INSERT INTO historial_ordenes (orden_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'observations', OLD.observations, NEW.observations);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

-- ---------- Notificaciones ----------

CREATE OR REPLACE FUNCTION notify_entrada_finalizado() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'finalizado' AND (TG_OP = 'INSERT' OR OLD.status <> 'finalizado') THEN
    INSERT INTO notifications (user_id, kind, parent_id, title, technician_email, finalized_at, message)
    VALUES (NEW.user_id, 'ticket', NEW.id, NEW.title, NEW.assigned_technician,
            COALESCE(NEW.fecha_finalizacion, now()),
            'Tu ticket "' || NEW.title || '" ha sido finalizado'
              || COALESCE(' por ' || NEW.assigned_technician, '') || '.');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION notify_orden_finalizado() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'finalizado' AND (TG_OP = 'INSERT' OR OLD.status <> 'finalizado') THEN
    INSERT INTO notifications (user_id, kind, parent_id, title, technician_email, finalized_at, message)
    VALUES (NEW.user_id, 'orden', NEW.id, NEW.title, NEW.assigned_technician,
            COALESCE(NEW.fecha_finalizacion, now()),
            'Tu orden de trabajo "' || NEW.title || '" ha sido finalizada'
              || COALESCE(' por ' || NEW.assigned_technician, '') || '.');
  END IF;
  RETURN NEW;
END; $$;

-- ---------- Snapshot reportes diarios ----------

CREATE OR REPLACE FUNCTION generar_snapshot_diario(fecha_objetivo date DEFAULT CURRENT_DATE)
RETURNS reportes_diarios
LANGUAGE plpgsql AS $$
DECLARE
  v_row reportes_diarios;
  v_total int; v_pend int; v_rev int; v_proc int; v_fin int; v_crit int;
  v_pb int; v_pm int; v_pa int; v_pc int;
  v_creados int; v_finalizados_dia int;
  v_avg numeric; v_sla numeric;
  v_por_tec jsonb; v_por_emp jsonb;
  v_dia_inicio timestamptz := (fecha_objetivo)::timestamptz;
  v_dia_fin    timestamptz := (fecha_objetivo + 1)::timestamptz;
BEGIN
  SELECT COUNT(*),
    COUNT(*) FILTER (WHERE status='pendiente'),
    COUNT(*) FILTER (WHERE status='en_revision'),
    COUNT(*) FILTER (WHERE status='en_proceso'),
    COUNT(*) FILTER (WHERE status='finalizado'),
    COUNT(*) FILTER (WHERE priority='critica' AND status<>'finalizado'),
    COUNT(*) FILTER (WHERE priority='baja'),
    COUNT(*) FILTER (WHERE priority='media'),
    COUNT(*) FILTER (WHERE priority='alta'),
    COUNT(*) FILTER (WHERE priority='critica')
  INTO v_total, v_pend, v_rev, v_proc, v_fin, v_crit, v_pb, v_pm, v_pa, v_pc
  FROM entradas;

  SELECT COUNT(*) INTO v_creados FROM entradas
   WHERE created_at >= v_dia_inicio AND created_at < v_dia_fin;

  SELECT COUNT(*) INTO v_finalizados_dia FROM entradas
   WHERE status='finalizado' AND updated_at >= v_dia_inicio AND updated_at < v_dia_fin;

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600.0), 0)
    INTO v_avg FROM entradas WHERE status='finalizado';

  SELECT COALESCE(
    100.0 * SUM(CASE WHEN EXTRACT(EPOCH FROM (updated_at-created_at))/3600.0 <=
      CASE priority WHEN 'critica' THEN 4 WHEN 'alta' THEN 8 WHEN 'media' THEN 24 ELSE 72 END
      THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0), 0)
    INTO v_sla FROM entradas WHERE status='finalizado';

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_por_tec FROM (
    SELECT e.assigned_technician AS email,
      COALESCE(p.full_name, p.username, e.assigned_technician) AS nombre,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE e.status='finalizado')::int AS finalizados,
      COUNT(*) FILTER (WHERE e.status<>'finalizado')::int AS activos
    FROM entradas e
    LEFT JOIN profiles p ON p.email = e.assigned_technician
    WHERE e.assigned_technician IS NOT NULL AND e.assigned_technician <> ''
    GROUP BY e.assigned_technician, p.full_name, p.username
    ORDER BY total DESC
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_por_emp FROM (
    SELECT c.id AS company_id, c.name AS nombre, COUNT(*)::int AS total
    FROM entradas e
    JOIN profiles p ON p.id = e.user_id
    JOIN companies c ON c.id = p.company_id
    GROUP BY c.id, c.name
    ORDER BY total DESC
  ) t;

  INSERT INTO reportes_diarios (
    fecha, total_tickets, pendientes, en_revision, en_proceso, finalizados, criticos,
    prioridad_baja, prioridad_media, prioridad_alta, prioridad_critica,
    tickets_creados, tickets_finalizados, tiempo_promedio_resolucion_horas, sla_cumplido_pct,
    tickets_por_tecnico, tickets_por_empresa
  ) VALUES (
    fecha_objetivo, v_total, v_pend, v_rev, v_proc, v_fin, v_crit,
    v_pb, v_pm, v_pa, v_pc, v_creados, v_finalizados_dia, v_avg, v_sla, v_por_tec, v_por_emp
  )
  ON CONFLICT (fecha) DO UPDATE SET
    total_tickets = EXCLUDED.total_tickets,
    pendientes = EXCLUDED.pendientes,
    en_revision = EXCLUDED.en_revision,
    en_proceso = EXCLUDED.en_proceso,
    finalizados = EXCLUDED.finalizados,
    criticos = EXCLUDED.criticos,
    prioridad_baja = EXCLUDED.prioridad_baja,
    prioridad_media = EXCLUDED.prioridad_media,
    prioridad_alta = EXCLUDED.prioridad_alta,
    prioridad_critica = EXCLUDED.prioridad_critica,
    tickets_creados = EXCLUDED.tickets_creados,
    tickets_finalizados = EXCLUDED.tickets_finalizados,
    tiempo_promedio_resolucion_horas = EXCLUDED.tiempo_promedio_resolucion_horas,
    sla_cumplido_pct = EXCLUDED.sla_cumplido_pct,
    tickets_por_tecnico = EXCLUDED.tickets_por_tecnico,
    tickets_por_empresa = EXCLUDED.tickets_por_empresa,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END; $$;

-- =====================================================================
-- TRIGGERS
-- =====================================================================

CREATE TRIGGER trg_usuarios_updated   BEFORE UPDATE ON usuarios   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_companies_updated  BEFORE UPDATE ON companies  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER technicians_set_updated_at BEFORE UPDATE ON technicians FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reportes_diarios_updated BEFORE UPDATE ON reportes_diarios FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_entradas_cronometro       BEFORE INSERT OR UPDATE ON entradas FOR EACH ROW EXECUTE FUNCTION entradas_cronometro();
CREATE TRIGGER tickets_updated_at            BEFORE UPDATE ON entradas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_log_entrada_changes       AFTER  INSERT OR UPDATE ON entradas FOR EACH ROW EXECUTE FUNCTION log_entrada_changes();
CREATE TRIGGER trg_notify_entrada_finalizado AFTER  INSERT OR UPDATE OF status ON entradas FOR EACH ROW EXECUTE FUNCTION notify_entrada_finalizado();
CREATE TRIGGER trg_reset_visto_on_assign     BEFORE INSERT OR UPDATE OF assigned_technician ON entradas FOR EACH ROW EXECUTE FUNCTION reset_visto_on_assign();

CREATE TRIGGER ordenes_cronometro_trg        BEFORE INSERT OR UPDATE ON ordenes_trabajo FOR EACH ROW EXECUTE FUNCTION ordenes_cronometro();
CREATE TRIGGER ordenes_set_updated_at        BEFORE UPDATE ON ordenes_trabajo FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ordenes_log_changes_trg       AFTER  INSERT OR UPDATE ON ordenes_trabajo FOR EACH ROW EXECUTE FUNCTION log_orden_changes();
CREATE TRIGGER ordenes_reset_visto_trg       BEFORE INSERT OR UPDATE ON ordenes_trabajo FOR EACH ROW EXECUTE FUNCTION reset_visto_orden_on_assign();
CREATE TRIGGER trg_notify_orden_finalizado   AFTER  INSERT OR UPDATE OF status ON ordenes_trabajo FOR EACH ROW EXECUTE FUNCTION notify_orden_finalizado();

CREATE TRIGGER trg_actividades_cronometro    BEFORE INSERT OR UPDATE ON actividades_tecnicas FOR EACH ROW EXECUTE FUNCTION actividades_cronometro();

-- =====================================================================
-- VISTAS de conveniencia
-- =====================================================================

CREATE OR REPLACE VIEW v_tickets_detallado AS
SELECT e.*,
       u.usuario  AS solicitante_usuario,
       u.nombre   AS solicitante_nombre,
       u.correo   AS solicitante_correo
FROM entradas e
LEFT JOIN usuarios u ON u.id = e.user_id;

CREATE OR REPLACE VIEW v_ordenes_detallado AS
SELECT o.*,
       u.usuario  AS solicitante_usuario,
       u.nombre   AS solicitante_nombre,
       u.correo   AS solicitante_correo,
       c.name     AS empresa
FROM ordenes_trabajo o
LEFT JOIN usuarios  u ON u.id = o.user_id
LEFT JOIN companies c ON c.id = o.company_id;

-- =====================================================================
-- FIN
-- =====================================================================

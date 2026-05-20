
-- Tabla de snapshots diarios
CREATE TABLE IF NOT EXISTS public.reportes_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL UNIQUE,
  total_tickets int NOT NULL DEFAULT 0,
  pendientes int NOT NULL DEFAULT 0,
  en_revision int NOT NULL DEFAULT 0,
  en_proceso int NOT NULL DEFAULT 0,
  finalizados int NOT NULL DEFAULT 0,
  criticos int NOT NULL DEFAULT 0,
  prioridad_baja int NOT NULL DEFAULT 0,
  prioridad_media int NOT NULL DEFAULT 0,
  prioridad_alta int NOT NULL DEFAULT 0,
  prioridad_critica int NOT NULL DEFAULT 0,
  tickets_creados int NOT NULL DEFAULT 0,
  tickets_finalizados int NOT NULL DEFAULT 0,
  tiempo_promedio_resolucion_horas numeric NOT NULL DEFAULT 0,
  sla_cumplido_pct numeric NOT NULL DEFAULT 0,
  tickets_por_tecnico jsonb NOT NULL DEFAULT '[]'::jsonb,
  tickets_por_empresa jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reportes_diarios_fecha ON public.reportes_diarios(fecha DESC);

ALTER TABLE public.reportes_diarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supervisors view reportes_diarios" ON public.reportes_diarios;
CREATE POLICY "Supervisors view reportes_diarios"
  ON public.reportes_diarios FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'::app_role));

CREATE TRIGGER trg_reportes_diarios_updated
BEFORE UPDATE ON public.reportes_diarios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Función para generar snapshot de un día específico
CREATE OR REPLACE FUNCTION public.generar_snapshot_diario(fecha_objetivo date DEFAULT current_date)
RETURNS public.reportes_diarios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.reportes_diarios;
  v_total int; v_pend int; v_rev int; v_proc int; v_fin int; v_crit int;
  v_pb int; v_pm int; v_pa int; v_pc int;
  v_creados int; v_finalizados_dia int;
  v_avg numeric; v_sla numeric;
  v_por_tec jsonb; v_por_emp jsonb;
  v_dia_inicio timestamptz := (fecha_objetivo)::timestamptz;
  v_dia_fin timestamptz := (fecha_objetivo + 1)::timestamptz;
BEGIN
  -- Estado actual global (snapshot)
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
  FROM public.entradas;

  -- Movimiento del día
  SELECT COUNT(*) INTO v_creados
  FROM public.entradas
  WHERE created_at >= v_dia_inicio AND created_at < v_dia_fin;

  SELECT COUNT(*) INTO v_finalizados_dia
  FROM public.entradas
  WHERE status='finalizado' AND updated_at >= v_dia_inicio AND updated_at < v_dia_fin;

  -- Tiempo promedio de resolución (horas) sobre tickets finalizados
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600.0), 0)
  INTO v_avg
  FROM public.entradas
  WHERE status='finalizado';

  -- % SLA cumplido: finalizados dentro de umbral por prioridad
  SELECT COALESCE(
    100.0 * SUM(CASE WHEN EXTRACT(EPOCH FROM (updated_at-created_at))/3600.0 <=
      CASE priority WHEN 'critica' THEN 4 WHEN 'alta' THEN 8 WHEN 'media' THEN 24 ELSE 72 END
      THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0), 0)
  INTO v_sla
  FROM public.entradas WHERE status='finalizado';

  -- Tickets por técnico (todos los tickets asignados)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_por_tec FROM (
    SELECT e.assigned_technician AS email,
      COALESCE(p.full_name, p.username, e.assigned_technician) AS nombre,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE e.status='finalizado')::int AS finalizados,
      COUNT(*) FILTER (WHERE e.status<>'finalizado')::int AS activos
    FROM public.entradas e
    LEFT JOIN public.profiles p ON p.email = e.assigned_technician
    WHERE e.assigned_technician IS NOT NULL AND e.assigned_technician <> ''
    GROUP BY e.assigned_technician, p.full_name, p.username
    ORDER BY total DESC
  ) t;

  -- Tickets por empresa
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_por_emp FROM (
    SELECT c.id AS company_id, c.name AS nombre, COUNT(*)::int AS total
    FROM public.entradas e
    JOIN public.profiles p ON p.id = e.user_id
    JOIN public.companies c ON c.id = p.company_id
    GROUP BY c.id, c.name
    ORDER BY total DESC
  ) t;

  INSERT INTO public.reportes_diarios (
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
END;
$$;

-- Programar cron diario 23:59
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('snapshot-reportes-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'snapshot-reportes-diario',
  '59 23 * * *',
  $$ SELECT public.generar_snapshot_diario(current_date); $$
);

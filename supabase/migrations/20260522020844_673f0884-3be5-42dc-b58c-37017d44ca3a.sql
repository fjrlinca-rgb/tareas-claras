
-- =========================================
-- Módulo: Órdenes de trabajo
-- =========================================

-- Flag por empresa para permitir creación de OT por clientes
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS puede_crear_ordenes boolean NOT NULL DEFAULT false;

-- Función helper: ¿la empresa del usuario puede crear OT?
CREATE OR REPLACE FUNCTION public.puede_crear_ordenes(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.puede_crear_ordenes
     FROM public.profiles p
     JOIN public.companies c ON c.id = p.company_id
     WHERE p.id = _user_id),
    false
  )
$$;

-- =========================
-- Tabla ordenes_trabajo
-- =========================
CREATE TABLE IF NOT EXISTS public.ordenes_trabajo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'pendiente',
  tipo text NOT NULL DEFAULT 'otro',
  assigned_technician text,
  observations text,
  evidencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  visto_por_tecnico boolean NOT NULL DEFAULT false,
  visto_por_supervisor boolean NOT NULL DEFAULT false,
  fecha_inicio_revision timestamptz,
  fecha_finalizacion timestamptz,
  tiempo_resolucion_segundos integer,
  tiempo_resolucion_texto text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ordenes_trabajo ENABLE ROW LEVEL SECURITY;

-- RLS: clientes ven solo lo suyo
CREATE POLICY "Clients view own ordenes"
  ON public.ordenes_trabajo FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Supervisors view all ordenes"
  ON public.ordenes_trabajo FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Technicians view assigned ordenes"
  ON public.ordenes_trabajo FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'tecnico'::app_role)
         AND assigned_technician = (auth.jwt() ->> 'email'));

-- INSERT: supervisor siempre; cliente sólo si su empresa lo permite
CREATE POLICY "Supervisors insert ordenes"
  ON public.ordenes_trabajo FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Clients insert ordenes if enabled"
  ON public.ordenes_trabajo FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.puede_crear_ordenes(auth.uid()));

CREATE POLICY "Supervisors update ordenes"
  ON public.ordenes_trabajo FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Technicians update assigned ordenes"
  ON public.ordenes_trabajo FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'tecnico'::app_role)
         AND assigned_technician = (auth.jwt() ->> 'email'))
  WITH CHECK (has_role(auth.uid(), 'tecnico'::app_role)
              AND assigned_technician = (auth.jwt() ->> 'email'));

CREATE POLICY "Supervisors delete ordenes"
  ON public.ordenes_trabajo FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

-- updated_at
CREATE TRIGGER ordenes_set_updated_at
  BEFORE UPDATE ON public.ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cronómetro (reusa misma lógica que entradas)
CREATE OR REPLACE FUNCTION public.ordenes_cronometro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      NEW.tiempo_resolucion_texto := public.format_duracion(NEW.tiempo_resolucion_segundos);
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
      NEW.tiempo_resolucion_texto := public.format_duracion(NEW.tiempo_resolucion_segundos);
    END IF;

    IF OLD.status = 'finalizado' AND NEW.status <> 'finalizado' THEN
      NEW.fecha_finalizacion := NULL;
      NEW.tiempo_resolucion_segundos := NULL;
      NEW.tiempo_resolucion_texto := NULL;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ordenes_cronometro_trg
  BEFORE INSERT OR UPDATE ON public.ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION public.ordenes_cronometro();

-- Reset visto al asignar
CREATE OR REPLACE FUNCTION public.reset_visto_orden_on_assign()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_technician IS NOT NULL THEN
      NEW.visto_por_tecnico := false;
    END IF;
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
END;
$$;

CREATE TRIGGER ordenes_reset_visto_trg
  BEFORE INSERT OR UPDATE ON public.ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION public.reset_visto_orden_on_assign();

-- =========================
-- Historial de ordenes
-- =========================
CREATE TABLE IF NOT EXISTS public.historial_ordenes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_id uuid NOT NULL,
  changed_by uuid,
  changed_by_email text,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historial_ordenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisor view orden history"
  ON public.historial_ordenes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Owner view orden history"
  ON public.historial_ordenes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ordenes_trabajo o
                 WHERE o.id = historial_ordenes.orden_id AND o.user_id = auth.uid()));

CREATE POLICY "Technician view orden history"
  ON public.historial_ordenes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'tecnico'::app_role)
         AND EXISTS (SELECT 1 FROM public.ordenes_trabajo o
                     WHERE o.id = historial_ordenes.orden_id
                       AND o.assigned_technician = (auth.jwt() ->> 'email')));

CREATE POLICY "Supervisor delete orden history"
  ON public.historial_ordenes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

CREATE OR REPLACE FUNCTION public.log_orden_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text := (auth.jwt() ->> 'email');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historial_ordenes (orden_id, changed_by, changed_by_email, action, field, new_value)
    VALUES (NEW.id, uid, uemail, 'created', NULL, NEW.status);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.historial_ordenes (orden_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'status', OLD.status, NEW.status);
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.historial_ordenes (orden_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'priority', OLD.priority, NEW.priority);
    END IF;
    IF COALESCE(NEW.assigned_technician,'') IS DISTINCT FROM COALESCE(OLD.assigned_technician,'') THEN
      INSERT INTO public.historial_ordenes (orden_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'assigned_technician', OLD.assigned_technician, NEW.assigned_technician);
    END IF;
    IF COALESCE(NEW.observations,'') IS DISTINCT FROM COALESCE(OLD.observations,'') THEN
      INSERT INTO public.historial_ordenes (orden_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'observations', OLD.observations, NEW.observations);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ordenes_log_changes_trg
  AFTER INSERT OR UPDATE ON public.ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION public.log_orden_changes();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordenes_trabajo;
ALTER TABLE public.ordenes_trabajo REPLICA IDENTITY FULL;

-- =========================
-- Storage bucket evidencias
-- =========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ordenes-evidencias', 'ordenes-evidencias', false)
ON CONFLICT (id) DO NOTHING;

-- Lectura: supervisor / técnico / dueño de la orden
CREATE POLICY "Read ordenes evidencias"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'ordenes-evidencias'
    AND (
      has_role(auth.uid(),'supervisor'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.ordenes_trabajo o
        WHERE o.id::text = (storage.foldername(name))[1]
          AND (
            o.user_id = auth.uid()
            OR (has_role(auth.uid(),'tecnico'::app_role)
                AND o.assigned_technician = (auth.jwt() ->> 'email'))
          )
      )
    )
  );

-- Upload: supervisor o técnico asignado a esa orden
CREATE POLICY "Upload ordenes evidencias"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ordenes-evidencias'
    AND (
      has_role(auth.uid(),'supervisor'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.ordenes_trabajo o
        WHERE o.id::text = (storage.foldername(name))[1]
          AND has_role(auth.uid(),'tecnico'::app_role)
          AND o.assigned_technician = (auth.jwt() ->> 'email')
      )
    )
  );

CREATE POLICY "Delete ordenes evidencias supervisor"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ordenes-evidencias' AND has_role(auth.uid(),'supervisor'::app_role));

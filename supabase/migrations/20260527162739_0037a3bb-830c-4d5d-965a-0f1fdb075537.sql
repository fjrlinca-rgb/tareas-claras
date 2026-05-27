
CREATE TABLE public.actividades_tecnicas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tecnico_id uuid NOT NULL,
  tecnico_email text,
  titulo text NOT NULL,
  descripcion text,
  tipo text NOT NULL DEFAULT 'otro',
  observaciones text,
  estado text NOT NULL DEFAULT 'en_curso',
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin timestamptz,
  tiempo_total_segundos integer,
  tiempo_total_texto text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.actividades_tecnicas TO authenticated;
GRANT ALL ON public.actividades_tecnicas TO service_role;

ALTER TABLE public.actividades_tecnicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tecnico ve sus actividades" ON public.actividades_tecnicas FOR SELECT TO authenticated USING (tecnico_id = auth.uid());
CREATE POLICY "Supervisor ve todas las actividades" ON public.actividades_tecnicas FOR SELECT TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Tecnico inserta sus actividades" ON public.actividades_tecnicas FOR INSERT TO authenticated WITH CHECK (tecnico_id = auth.uid() AND has_role(auth.uid(), 'tecnico'::app_role));
CREATE POLICY "Supervisor inserta actividades" ON public.actividades_tecnicas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Tecnico actualiza sus actividades" ON public.actividades_tecnicas FOR UPDATE TO authenticated USING (tecnico_id = auth.uid()) WITH CHECK (tecnico_id = auth.uid());
CREATE POLICY "Supervisor actualiza actividades" ON public.actividades_tecnicas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisor elimina actividades" ON public.actividades_tecnicas FOR DELETE TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Tecnico elimina sus actividades en curso" ON public.actividades_tecnicas FOR DELETE TO authenticated USING (tecnico_id = auth.uid() AND estado = 'en_curso');

CREATE OR REPLACE FUNCTION public.actividades_cronometro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.fecha_inicio IS NULL THEN NEW.fecha_inicio := now(); END IF;
    IF NEW.estado = 'finalizada' THEN
      NEW.fecha_fin := COALESCE(NEW.fecha_fin, now());
      NEW.tiempo_total_segundos := GREATEST(EXTRACT(EPOCH FROM (NEW.fecha_fin - NEW.fecha_inicio))::int, 0);
      NEW.tiempo_total_texto := public.format_duracion(NEW.tiempo_total_segundos);
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.estado = 'finalizada' AND OLD.estado <> 'finalizada' THEN
      NEW.fecha_fin := COALESCE(NEW.fecha_fin, now());
      NEW.tiempo_total_segundos := GREATEST(EXTRACT(EPOCH FROM (NEW.fecha_fin - NEW.fecha_inicio))::int, 0);
      NEW.tiempo_total_texto := public.format_duracion(NEW.tiempo_total_segundos);
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
END;
$$;

CREATE TRIGGER trg_actividades_cronometro
BEFORE INSERT OR UPDATE ON public.actividades_tecnicas
FOR EACH ROW EXECUTE FUNCTION public.actividades_cronometro();

ALTER PUBLICATION supabase_realtime ADD TABLE public.actividades_tecnicas;
ALTER TABLE public.actividades_tecnicas REPLICA IDENTITY FULL;

-- Replace can_access_parent (same signature) to allow 'actividad' attachments
CREATE OR REPLACE FUNCTION public.can_access_parent(_parent_type text, _parent_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(auth.uid(), 'supervisor'::app_role)
    OR (
      _parent_type = 'ticket' AND EXISTS (
        SELECT 1 FROM public.entradas e
        WHERE e.id = _parent_id
          AND (e.user_id = auth.uid()
               OR (public.has_role(auth.uid(), 'tecnico'::app_role)
                   AND e.assigned_technician = (auth.jwt() ->> 'email')))
      )
    )
    OR (
      _parent_type = 'orden' AND EXISTS (
        SELECT 1 FROM public.ordenes_trabajo o
        WHERE o.id = _parent_id
          AND (o.user_id = auth.uid()
               OR (public.has_role(auth.uid(), 'tecnico'::app_role)
                   AND o.assigned_technician = (auth.jwt() ->> 'email')))
      )
    )
    OR (
      _parent_type = 'actividad' AND EXISTS (
        SELECT 1 FROM public.actividades_tecnicas a
        WHERE a.id = _parent_id AND a.tecnico_id = auth.uid()
      )
    );
$$;

-- Storage bucket for activity attachments (reuse tickets-files style)
INSERT INTO storage.buckets (id, name, public) VALUES ('actividades-files', 'actividades-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "actividades-files read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'actividades-files' AND (
  has_role(auth.uid(), 'supervisor'::app_role)
  OR EXISTS (SELECT 1 FROM public.actividades_tecnicas a WHERE a.id::text = (storage.foldername(name))[1] AND a.tecnico_id = auth.uid())
));

CREATE POLICY "actividades-files insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'actividades-files' AND EXISTS (
  SELECT 1 FROM public.actividades_tecnicas a WHERE a.id::text = (storage.foldername(name))[1] AND a.tecnico_id = auth.uid()
));

CREATE POLICY "actividades-files delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'actividades-files' AND (
  has_role(auth.uid(), 'supervisor'::app_role)
  OR EXISTS (SELECT 1 FROM public.actividades_tecnicas a WHERE a.id::text = (storage.foldername(name))[1] AND a.tecnico_id = auth.uid())
));

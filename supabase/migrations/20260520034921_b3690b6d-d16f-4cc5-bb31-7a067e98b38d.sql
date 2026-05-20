
ALTER TABLE public.entradas
  ADD COLUMN IF NOT EXISTS fecha_inicio_revision timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_finalizacion timestamptz,
  ADD COLUMN IF NOT EXISTS tiempo_resolucion_segundos integer,
  ADD COLUMN IF NOT EXISTS tiempo_resolucion_texto text;

CREATE OR REPLACE FUNCTION public.format_duracion(segundos integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s integer := GREATEST(COALESCE(segundos, 0), 0);
  d integer; h integer; m integer;
BEGIN
  d := s / 86400;
  h := (s % 86400) / 3600;
  m := (s % 3600) / 60;
  IF d > 0 THEN
    RETURN d || ' d ' || h || ' h';
  ELSIF h > 0 THEN
    RETURN h || ' h ' || m || ' min';
  ELSE
    RETURN GREATEST(m, 1) || ' min';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.entradas_cronometro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('en_revision', 'en_proceso') AND NEW.fecha_inicio_revision IS NULL THEN
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
    -- Inicio de revisión / proceso (sólo se setea una vez)
    IF NEW.status IN ('en_revision', 'en_proceso')
       AND OLD.status NOT IN ('en_revision', 'en_proceso', 'finalizado')
       AND NEW.fecha_inicio_revision IS NULL THEN
      NEW.fecha_inicio_revision := now();
    END IF;

    -- Finalización
    IF NEW.status = 'finalizado' AND OLD.status <> 'finalizado' THEN
      IF NEW.fecha_inicio_revision IS NULL THEN
        NEW.fecha_inicio_revision := COALESCE(OLD.fecha_inicio_revision, OLD.created_at, now());
      END IF;
      NEW.fecha_finalizacion := now();
      NEW.tiempo_resolucion_segundos := GREATEST(EXTRACT(EPOCH FROM (NEW.fecha_finalizacion - NEW.fecha_inicio_revision))::int, 0);
      NEW.tiempo_resolucion_texto := public.format_duracion(NEW.tiempo_resolucion_segundos);
    END IF;

    -- Si reabren un ticket finalizado, limpiar cierre
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

DROP TRIGGER IF EXISTS trg_entradas_cronometro ON public.entradas;
CREATE TRIGGER trg_entradas_cronometro
BEFORE INSERT OR UPDATE ON public.entradas
FOR EACH ROW EXECUTE FUNCTION public.entradas_cronometro();

-- Rellenar tickets ya finalizados (histórico)
UPDATE public.entradas
SET fecha_inicio_revision = COALESCE(fecha_inicio_revision, created_at),
    fecha_finalizacion = COALESCE(fecha_finalizacion, updated_at),
    tiempo_resolucion_segundos = COALESCE(
      tiempo_resolucion_segundos,
      GREATEST(EXTRACT(EPOCH FROM (COALESCE(fecha_finalizacion, updated_at) - COALESCE(fecha_inicio_revision, created_at)))::int, 0)
    )
WHERE status = 'finalizado';

UPDATE public.entradas
SET tiempo_resolucion_texto = public.format_duracion(tiempo_resolucion_segundos)
WHERE status = 'finalizado' AND tiempo_resolucion_texto IS NULL;

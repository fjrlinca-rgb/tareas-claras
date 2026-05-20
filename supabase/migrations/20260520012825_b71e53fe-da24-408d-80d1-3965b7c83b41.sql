ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS visto_por_tecnico boolean NOT NULL DEFAULT false;

-- Mark all existing tickets as seen so the counter starts clean
UPDATE public.entradas SET visto_por_tecnico = true WHERE visto_por_tecnico = false;

-- Trigger: when assigned_technician changes (assignment / reassignment), reset visto
CREATE OR REPLACE FUNCTION public.reset_visto_on_assign()
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

DROP TRIGGER IF EXISTS trg_reset_visto_on_assign ON public.entradas;
CREATE TRIGGER trg_reset_visto_on_assign
BEFORE INSERT OR UPDATE OF assigned_technician ON public.entradas
FOR EACH ROW EXECUTE FUNCTION public.reset_visto_on_assign();
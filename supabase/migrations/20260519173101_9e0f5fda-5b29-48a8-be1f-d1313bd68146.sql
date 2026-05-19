
-- Historial de cambios de tickets
CREATE TABLE public.ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.entradas(id) ON DELETE CASCADE,
  changed_by uuid,
  changed_by_email text,
  action text NOT NULL, -- 'created' | 'updated'
  field text,           -- 'status' | 'priority' | 'assigned_technician' | 'observations' | null para created
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_history_ticket ON public.ticket_history(ticket_id, created_at DESC);

ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;

-- Ver historial: dueño, técnico asignado, supervisor
CREATE POLICY "View history (owner)" ON public.ticket_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.entradas e WHERE e.id = ticket_history.ticket_id AND e.user_id = auth.uid()));

CREATE POLICY "View history (technician)" ON public.ticket_history FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'tecnico'::app_role)
  AND EXISTS (SELECT 1 FROM public.entradas e WHERE e.id = ticket_history.ticket_id AND e.assigned_technician = (auth.jwt() ->> 'email'))
);

CREATE POLICY "View history (supervisor)" ON public.ticket_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Supervisor delete history" ON public.ticket_history FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'::app_role));

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_entrada_changes()
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
    INSERT INTO public.ticket_history (ticket_id, changed_by, changed_by_email, action, field, new_value)
    VALUES (NEW.id, uid, uemail, 'created', NULL, NEW.status);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.ticket_history (ticket_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'status', OLD.status, NEW.status);
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.ticket_history (ticket_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'priority', OLD.priority, NEW.priority);
    END IF;
    IF COALESCE(NEW.assigned_technician,'') IS DISTINCT FROM COALESCE(OLD.assigned_technician,'') THEN
      INSERT INTO public.ticket_history (ticket_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'assigned_technician', OLD.assigned_technician, NEW.assigned_technician);
    END IF;
    IF COALESCE(NEW.observations,'') IS DISTINCT FROM COALESCE(OLD.observations,'') THEN
      INSERT INTO public.ticket_history (ticket_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'updated', 'observations', OLD.observations, NEW.observations);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_entrada_changes ON public.entradas;
CREATE TRIGGER trg_log_entrada_changes
AFTER INSERT OR UPDATE ON public.entradas
FOR EACH ROW EXECUTE FUNCTION public.log_entrada_changes();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_history;

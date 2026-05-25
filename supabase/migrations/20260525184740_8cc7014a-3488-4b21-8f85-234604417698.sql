CREATE OR REPLACE FUNCTION public.log_entrada_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  uemail text := (auth.jwt() ->> 'email');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_history (ticket_id, changed_by, changed_by_email, action, field, new_value)
    VALUES (NEW.id, uid, uemail, 'created', NULL, NEW.status);
    IF NEW.assigned_technician IS NOT NULL AND NEW.assigned_technician <> '' THEN
      INSERT INTO public.ticket_history (ticket_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'assigned_on_create', 'assigned_technician', NULL, NEW.assigned_technician);
    END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.log_orden_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  uemail text := (auth.jwt() ->> 'email');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historial_ordenes (orden_id, changed_by, changed_by_email, action, field, new_value)
    VALUES (NEW.id, uid, uemail, 'created', NULL, NEW.status);
    IF NEW.assigned_technician IS NOT NULL AND NEW.assigned_technician <> '' THEN
      INSERT INTO public.historial_ordenes (orden_id, changed_by, changed_by_email, action, field, old_value, new_value)
      VALUES (NEW.id, uid, uemail, 'assigned_on_create', 'assigned_technician', NULL, NEW.assigned_technician);
    END IF;
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
$function$;
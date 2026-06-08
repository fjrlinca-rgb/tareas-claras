
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ticket','orden')),
  parent_id uuid NOT NULL,
  title text NOT NULL,
  technician_email text,
  finalized_at timestamptz NOT NULL DEFAULT now(),
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Allow inserts by authenticated users (triggers run as SECURITY DEFINER but policy is required for through-trigger inserts when invoker context applies)
CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger functions
CREATE OR REPLACE FUNCTION public.notify_entrada_finalizado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finalizado' AND (TG_OP = 'INSERT' OR OLD.status <> 'finalizado') THEN
    INSERT INTO public.notifications (user_id, kind, parent_id, title, technician_email, finalized_at, message)
    VALUES (
      NEW.user_id,
      'ticket',
      NEW.id,
      NEW.title,
      NEW.assigned_technician,
      COALESCE(NEW.fecha_finalizacion, now()),
      'Tu ticket "' || NEW.title || '" ha sido finalizado'
        || COALESCE(' por ' || NEW.assigned_technician, '')
        || '.'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_orden_finalizado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finalizado' AND (TG_OP = 'INSERT' OR OLD.status <> 'finalizado') THEN
    INSERT INTO public.notifications (user_id, kind, parent_id, title, technician_email, finalized_at, message)
    VALUES (
      NEW.user_id,
      'orden',
      NEW.id,
      NEW.title,
      NEW.assigned_technician,
      COALESCE(NEW.fecha_finalizacion, now()),
      'Tu orden de trabajo "' || NEW.title || '" ha sido finalizada'
        || COALESCE(' por ' || NEW.assigned_technician, '')
        || '.'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_entrada_finalizado
  AFTER INSERT OR UPDATE OF status ON public.entradas
  FOR EACH ROW EXECUTE FUNCTION public.notify_entrada_finalizado();

CREATE TRIGGER trg_notify_orden_finalizado
  AFTER INSERT OR UPDATE OF status ON public.ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION public.notify_orden_finalizado();

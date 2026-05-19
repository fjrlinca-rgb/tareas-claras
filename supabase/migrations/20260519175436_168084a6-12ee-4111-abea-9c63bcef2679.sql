
-- Technicians directory (managed by supervisors)
CREATE TABLE IF NOT EXISTS public.technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  specialty text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the directory (needed to render labels in tickets)
CREATE POLICY "Authenticated read technicians"
  ON public.technicians FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Supervisors insert technicians"
  ON public.technicians FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Supervisors update technicians"
  ON public.technicians FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Supervisors delete technicians"
  ON public.technicians FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

CREATE TRIGGER technicians_set_updated_at
  BEFORE UPDATE ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.technicians;
ALTER TABLE public.technicians REPLICA IDENTITY FULL;


-- =============================================================
-- Adjuntos para tickets y órdenes de trabajo
-- =============================================================

CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type text NOT NULL CHECK (parent_type IN ('ticket','orden')),
  parent_id uuid NOT NULL,
  bucket text NOT NULL,
  path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  uploaded_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_parent ON public.attachments(parent_type, parent_id);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Helper: ¿puede el usuario actual ver este parent?
CREATE OR REPLACE FUNCTION public.can_access_parent(_parent_type text, _parent_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
$$;

CREATE POLICY "View attachments by parent access"
  ON public.attachments FOR SELECT
  TO authenticated
  USING (public.can_access_parent(parent_type, parent_id));

CREATE POLICY "Insert attachments by parent access"
  ON public.attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.can_access_parent(parent_type, parent_id)
  );

CREATE POLICY "Delete own attachments or supervisor"
  ON public.attachments FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

-- Realtime
ALTER TABLE public.attachments REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attachments';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.attachments';
  END IF;
END $$;

-- =============================================================
-- Storage buckets
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('tickets-files', 'tickets-files', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('ordenes-files', 'ordenes-files', false)
ON CONFLICT (id) DO NOTHING;

-- Helper para storage policies: extraer parent_id (primer segmento del path)
-- Usamos (storage.foldername(name))[1] como uuid del parent.

-- ===== tickets-files =====
CREATE POLICY "tickets-files read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tickets-files'
    AND public.can_access_parent('ticket', ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "tickets-files insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tickets-files'
    AND public.can_access_parent('ticket', ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "tickets-files delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tickets-files'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
    )
  );

-- ===== ordenes-files =====
CREATE POLICY "ordenes-files read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ordenes-files'
    AND public.can_access_parent('orden', ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "ordenes-files insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ordenes-files'
    AND public.can_access_parent('orden', ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "ordenes-files delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ordenes-files'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
    )
  );

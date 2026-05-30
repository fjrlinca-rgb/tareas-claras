
-- Allow uploads to draft tickets/ordenes (parent not yet inserted) while keeping access control.

DROP POLICY IF EXISTS "tickets-files insert" ON storage.objects;
DROP POLICY IF EXISTS "tickets-files read" ON storage.objects;
DROP POLICY IF EXISTS "tickets-files delete" ON storage.objects;

CREATE POLICY "tickets-files insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tickets-files'
  AND (
    NOT EXISTS (SELECT 1 FROM public.entradas e WHERE e.id = ((storage.foldername(name))[1])::uuid)
    OR public.can_access_parent('ticket', ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "tickets-files read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'tickets-files'
  AND (
    owner = auth.uid()
    OR public.can_access_parent('ticket', ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "tickets-files update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'tickets-files'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'supervisor'::app_role))
)
WITH CHECK (bucket_id = 'tickets-files');

CREATE POLICY "tickets-files delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'tickets-files'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'supervisor'::app_role))
);

DROP POLICY IF EXISTS "ordenes-files insert" ON storage.objects;
DROP POLICY IF EXISTS "ordenes-files read" ON storage.objects;
DROP POLICY IF EXISTS "ordenes-files delete" ON storage.objects;

CREATE POLICY "ordenes-files insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ordenes-files'
  AND (
    NOT EXISTS (SELECT 1 FROM public.ordenes_trabajo o WHERE o.id = ((storage.foldername(name))[1])::uuid)
    OR public.can_access_parent('orden', ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "ordenes-files read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'ordenes-files'
  AND (
    owner = auth.uid()
    OR public.can_access_parent('orden', ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "ordenes-files update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'ordenes-files'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'supervisor'::app_role))
)
WITH CHECK (bucket_id = 'ordenes-files');

CREATE POLICY "ordenes-files delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'ordenes-files'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'supervisor'::app_role))
);

-- Same for actividades-files (drafts)
DROP POLICY IF EXISTS "actividades-files insert" ON storage.objects;
CREATE POLICY "actividades-files insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'actividades-files'
  AND (
    NOT EXISTS (SELECT 1 FROM public.actividades_tecnicas a WHERE a.id = ((storage.foldername(name))[1])::uuid)
    OR EXISTS (
      SELECT 1 FROM public.actividades_tecnicas a
      WHERE a.id = ((storage.foldername(name))[1])::uuid
        AND (a.tecnico_id = auth.uid() OR public.has_role(auth.uid(),'supervisor'::app_role))
    )
  )
);

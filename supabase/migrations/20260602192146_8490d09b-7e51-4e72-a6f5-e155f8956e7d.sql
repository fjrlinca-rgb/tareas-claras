
-- Reset policies for tickets-files, ordenes-files, actividades-files
DROP POLICY IF EXISTS "tickets-files insert" ON storage.objects;
DROP POLICY IF EXISTS "tickets-files read" ON storage.objects;
DROP POLICY IF EXISTS "tickets-files update" ON storage.objects;
DROP POLICY IF EXISTS "tickets-files delete" ON storage.objects;

DROP POLICY IF EXISTS "ordenes-files insert" ON storage.objects;
DROP POLICY IF EXISTS "ordenes-files read" ON storage.objects;
DROP POLICY IF EXISTS "ordenes-files update" ON storage.objects;
DROP POLICY IF EXISTS "ordenes-files delete" ON storage.objects;

DROP POLICY IF EXISTS "actividades-files insert" ON storage.objects;
DROP POLICY IF EXISTS "actividades-files read" ON storage.objects;
DROP POLICY IF EXISTS "actividades-files update" ON storage.objects;
DROP POLICY IF EXISTS "actividades-files delete" ON storage.objects;

-- tickets-files
CREATE POLICY "tickets-files insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tickets-files');

CREATE POLICY "tickets-files read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'tickets-files');

CREATE POLICY "tickets-files update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'tickets-files' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'supervisor'::app_role)))
  WITH CHECK (bucket_id = 'tickets-files');

CREATE POLICY "tickets-files delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tickets-files' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'supervisor'::app_role)));

-- ordenes-files
CREATE POLICY "ordenes-files insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ordenes-files');

CREATE POLICY "ordenes-files read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ordenes-files');

CREATE POLICY "ordenes-files update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ordenes-files' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'supervisor'::app_role)))
  WITH CHECK (bucket_id = 'ordenes-files');

CREATE POLICY "ordenes-files delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ordenes-files' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'supervisor'::app_role)));

-- actividades-files
CREATE POLICY "actividades-files insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'actividades-files');

CREATE POLICY "actividades-files read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'actividades-files');

CREATE POLICY "actividades-files update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'actividades-files' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'supervisor'::app_role)))
  WITH CHECK (bucket_id = 'actividades-files');

CREATE POLICY "actividades-files delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'actividades-files' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'supervisor'::app_role)));

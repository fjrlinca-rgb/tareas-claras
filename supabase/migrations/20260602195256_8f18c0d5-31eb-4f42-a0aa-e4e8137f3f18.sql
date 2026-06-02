-- Fix attachments INSERT policy to allow drafts (parent not yet created) and owners/technicians/supervisors
DROP POLICY IF EXISTS "Insert attachments by parent access" ON public.attachments;
DROP POLICY IF EXISTS "View attachments by parent access" ON public.attachments;
DROP POLICY IF EXISTS "Delete own attachments or supervisor" ON public.attachments;

-- INSERT: allow when uploaded_by = auth.uid() AND (parent is accessible OR parent doesn't exist yet i.e. draft)
CREATE POLICY "Insert attachments owner or parent access"
ON public.attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.can_access_parent(parent_type, parent_id)
    OR (
      parent_type = 'ticket'
      AND NOT EXISTS (SELECT 1 FROM public.entradas WHERE id = parent_id)
    )
    OR (
      parent_type = 'orden'
      AND NOT EXISTS (SELECT 1 FROM public.ordenes_trabajo WHERE id = parent_id)
    )
    OR (
      parent_type = 'actividad'
      AND NOT EXISTS (SELECT 1 FROM public.actividades_tecnicas WHERE id = parent_id)
    )
  )
);

-- SELECT: parent access OR owner of attachment (covers drafts before parent exists)
CREATE POLICY "View attachments owner or parent access"
ON public.attachments
FOR SELECT
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
  OR public.can_access_parent(parent_type, parent_id)
);

-- DELETE: owner of the attachment or supervisor
CREATE POLICY "Delete attachments owner or supervisor"
ON public.attachments
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
);
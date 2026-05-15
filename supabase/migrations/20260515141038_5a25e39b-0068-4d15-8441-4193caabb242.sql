
ALTER TABLE public.tasks RENAME TO tickets;
ALTER INDEX idx_tasks_user RENAME TO idx_tickets_user;
DROP INDEX IF EXISTS idx_tasks_due;

ALTER TABLE public.tickets DROP COLUMN IF EXISTS category;
ALTER TABLE public.tickets DROP COLUMN IF EXISTS due_date;
ALTER TABLE public.tickets DROP COLUMN IF EXISTS completed;
ALTER TABLE public.tickets DROP COLUMN IF EXISTS completed_at;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tickets ALTER COLUMN priority SET DEFAULT 'media';
ALTER TABLE public.tickets ADD CONSTRAINT tickets_priority_check
  CHECK (priority IN ('baja','media','alta','critica'));

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendiente';
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('pendiente','en_proceso','finalizado'));

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS assigned_technician TEXT;

DROP POLICY IF EXISTS "Users view own tasks" ON public.tickets;
DROP POLICY IF EXISTS "Users insert own tasks" ON public.tickets;
DROP POLICY IF EXISTS "Users update own tasks" ON public.tickets;
DROP POLICY IF EXISTS "Users delete own tasks" ON public.tickets;

CREATE POLICY "Users view own tickets" ON public.tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tickets" ON public.tickets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own tickets" ON public.tickets FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tickets;
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

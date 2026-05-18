ALTER TABLE public.tickets RENAME TO entradas;

-- Recreate policies with updated names
DROP POLICY IF EXISTS "Users view own tickets" ON public.entradas;
DROP POLICY IF EXISTS "Users insert own tickets" ON public.entradas;
DROP POLICY IF EXISTS "Users update own tickets" ON public.entradas;
DROP POLICY IF EXISTS "Users delete own tickets" ON public.entradas;

CREATE POLICY "Users view own entradas" ON public.entradas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own entradas" ON public.entradas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own entradas" ON public.entradas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own entradas" ON public.entradas FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Re-attach updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.entradas;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.entradas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('cliente', 'supervisor', 'tecnico');

-- Tabla user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Función security definer para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Políticas user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Supervisors can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'))
WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

-- Trigger: asignar rol cliente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cliente')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Columna observaciones
ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS observations TEXT;

-- Reemplazar políticas de entradas
DROP POLICY IF EXISTS "Users view own entradas" ON public.entradas;
DROP POLICY IF EXISTS "Users insert own entradas" ON public.entradas;
DROP POLICY IF EXISTS "Users update own entradas" ON public.entradas;
DROP POLICY IF EXISTS "Users delete own entradas" ON public.entradas;

-- SELECT
CREATE POLICY "Clients view own entradas"
ON public.entradas FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Supervisors view all entradas"
ON public.entradas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Technicians view assigned entradas"
ON public.entradas FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'tecnico')
  AND assigned_technician = (auth.jwt() ->> 'email')
);

-- INSERT
CREATE POLICY "Authenticated insert own entradas"
ON public.entradas FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE
CREATE POLICY "Supervisors update entradas"
ON public.entradas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'))
WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Technicians update assigned entradas"
ON public.entradas FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'tecnico')
  AND assigned_technician = (auth.jwt() ->> 'email')
)
WITH CHECK (
  public.has_role(auth.uid(), 'tecnico')
  AND assigned_technician = (auth.jwt() ->> 'email')
);

-- DELETE solo supervisor
CREATE POLICY "Supervisors delete entradas"
ON public.entradas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'));

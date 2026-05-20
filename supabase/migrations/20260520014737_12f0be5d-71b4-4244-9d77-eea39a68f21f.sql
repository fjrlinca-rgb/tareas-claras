
ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS visto_por_supervisor boolean NOT NULL DEFAULT false;

-- Marcar existentes como vistos para no inundar el contador
UPDATE public.entradas SET visto_por_supervisor = true WHERE visto_por_supervisor = false;

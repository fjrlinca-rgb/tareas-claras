
CREATE OR REPLACE FUNCTION public.format_duracion(segundos integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s integer := GREATEST(COALESCE(segundos, 0), 0);
  d integer; h integer; m integer;
BEGIN
  d := s / 86400;
  h := (s % 86400) / 3600;
  m := (s % 3600) / 60;
  IF d > 0 THEN
    RETURN d || ' d ' || h || ' h';
  ELSIF h > 0 THEN
    RETURN h || ' h ' || m || ' min';
  ELSE
    RETURN GREATEST(m, 1) || ' min';
  END IF;
END;
$$;

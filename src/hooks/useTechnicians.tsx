import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Technician { id: string; email: string; }

export function useTechnicians(enabled: boolean = true) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles").select("user_id").eq("role", "tecnico");
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) { setTechnicians([]); setLoading(false); return; }
    const { data: profs } = await supabase
      .from("profiles").select("id,email").in("id", ids);
    setTechnicians(((profs ?? []) as any[])
      .filter((p) => !!p.email)
      .map((p) => ({ id: p.id, email: p.email as string }))
      .sort((a, b) => a.email.localeCompare(b.email)));
    setLoading(false);
  }, []);

  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  return { technicians, loading, reload: load };
}

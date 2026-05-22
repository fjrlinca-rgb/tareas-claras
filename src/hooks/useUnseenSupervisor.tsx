import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

/**
 * Cuenta items pendientes aún no revisados por el supervisor. Tabla configurable.
 */
export function useUnseenSupervisor(table: string = "entradas") {
  const { isSupervisor } = useUserRole();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!isSupervisor) { setCount(0); return; }
    const { count: c } = await supabase
      .from(table as any)
      .select("id", { count: "exact", head: true })
      .eq("status", "pendiente")
      .eq("visto_por_supervisor", false);
    setCount(c ?? 0);
  }, [isSupervisor, table]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isSupervisor) return;
    const ch = supabase
      .channel(`unseen-sup-rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isSupervisor, load, table]);

  return count;
}

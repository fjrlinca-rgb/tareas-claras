import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

/**
 * Cuenta tickets pendientes aún no revisados por el supervisor.
 */
export function useUnseenSupervisor() {
  const { isSupervisor } = useUserRole();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!isSupervisor) { setCount(0); return; }
    const { count: c } = await supabase
      .from("entradas")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendiente")
      .eq("visto_por_supervisor", false);
    setCount(c ?? 0);
  }, [isSupervisor]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isSupervisor) return;
    const ch = supabase
      .channel(`unseen-sup-rt-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "entradas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isSupervisor, load]);

  return count;
}

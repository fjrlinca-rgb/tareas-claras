import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

/**
 * Cuenta items asignados al técnico actual con estado pendiente y aún no
 * vistos. Se actualiza vía realtime. Tabla configurable.
 */
export function useUnseenTickets(table: string = "entradas") {
  const { user } = useAuth();
  const { isTecnico } = useUserRole();
  const [count, setCount] = useState(0);

  const email = user?.email?.toLowerCase() ?? null;

  const load = useCallback(async () => {
    if (!isTecnico || !email) { setCount(0); return; }
    const { count: c } = await supabase
      .from(table as any)
      .select("id", { count: "exact", head: true })
      .eq("assigned_technician", email)
      .eq("status", "pendiente")
      .eq("visto_por_tecnico", false);
    setCount(c ?? 0);
  }, [isTecnico, email, table]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isTecnico || !email) return;
    const ch = supabase
      .channel(`unseen-rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isTecnico, email, load, table]);

  return count;
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

/**
 * Cuenta tickets asignados al técnico actual con estado pendiente y aún no
 * vistos (visto_por_tecnico = false). Se actualiza vía realtime.
 */
export function useUnseenTickets() {
  const { user } = useAuth();
  const { isTecnico } = useUserRole();
  const [count, setCount] = useState(0);

  const email = user?.email?.toLowerCase() ?? null;

  const load = useCallback(async () => {
    if (!isTecnico || !email) { setCount(0); return; }
    const { count: c } = await supabase
      .from("entradas")
      .select("id", { count: "exact", head: true })
      .eq("assigned_technician", email)
      .eq("status", "pendiente")
      .eq("visto_por_tecnico", false);
    setCount(c ?? 0);
  }, [isTecnico, email]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isTecnico || !email) return;
    const ch = supabase
      .channel(`unseen-rt-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "entradas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isTecnico, email, load]);

  return count;
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "cliente" | "supervisor" | "tecnico";

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRoles([]); setLoading(false); return; }
    let active = true;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (active) {
        setRoles((data ?? []).map((r: any) => r.role as AppRole));
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user, authLoading]);

  const isSupervisor = roles.includes("supervisor");
  const isTecnico = roles.includes("tecnico");
  const isCliente = roles.includes("cliente") || (!isSupervisor && !isTecnico);
  // Primary effective role: supervisor > tecnico > cliente
  const primary: AppRole = isSupervisor ? "supervisor" : isTecnico ? "tecnico" : "cliente";

  return { roles, primary, isSupervisor, isTecnico, isCliente, loading };
}

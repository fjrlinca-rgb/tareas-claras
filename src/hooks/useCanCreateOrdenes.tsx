import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

/**
 * Determina si el usuario actual puede ver/usar el módulo "Orden de trabajo".
 * - supervisor / técnico: siempre true
 * - cliente: solo si su empresa tiene `puede_crear_ordenes = true`
 */
export function useCanCreateOrdenes() {
  const { user } = useAuth();
  const { isSupervisor, isTecnico, isCliente, loading: roleLoading } = useUserRole();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roleLoading) return;
    if (!user) { setEnabled(false); setLoading(false); return; }
    if (isSupervisor || isTecnico) { setEnabled(true); setLoading(false); return; }
    if (!isCliente) { setEnabled(false); setLoading(false); return; }

    let active = true;
    const load = async () => {
      const { data: prof } = await supabase
        .from("profiles").select("company_id").eq("id", user.id).maybeSingle();
      if (!prof?.company_id) { if (active) { setEnabled(false); setLoading(false); } return; }
      const { data: comp } = await supabase
        .from("companies").select("puede_crear_ordenes").eq("id", prof.company_id).maybeSingle();
      if (active) { setEnabled(!!comp?.puede_crear_ordenes); setLoading(false); }
    };
    load();

    // Realtime: si supervisor cambia el toggle, refrescar
    const channel = supabase
      .channel(`companies-ordenes-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "companies" }, () => load());
    channel.subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [user, isSupervisor, isTecnico, isCliente, roleLoading]);

  return { enabled, loading };
}

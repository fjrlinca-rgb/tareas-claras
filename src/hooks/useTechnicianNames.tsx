import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Devuelve un mapa { emailLower -> nombre amigable } para todos los
 * usuarios con rol `tecnico`. Fuente ÚNICA: user_roles + profiles.
 * No usa la tabla legacy `technicians`.
 */
export function useTechnicianNames() {
  const [map, setMap] = useState<Map<string, string>>(new Map());
  const loadingRef = useRef(false);
  const pendingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) { pendingRef.current = true; return; }
    loadingRef.current = true;
    try {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "tecnico");
      const userIds = Array.from(
        new Set((Array.isArray(roleRows) ? roleRows : []).map((r: any) => r?.user_id).filter(Boolean))
      );

      if (userIds.length === 0) { setMap(new Map()); return; }

      const { data: profs } = await supabase
        .from("profiles")
        .select("email,full_name,username")
        .in("id", userIds);

      const m = new Map<string, string>();
      (Array.isArray(profs) ? profs : []).forEach((p: any) => {
        if (!p?.email) return;
        const name = p.username || p.full_name;
        if (name) m.set(String(p.email).toLowerCase(), name);
      });
      setMap(m);
    } catch (e) {
      console.error("[useTechnicianNames] load failed", e);
      setMap(new Map());
    } finally {
      loadingRef.current = false;
      pendingRef.current = false;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channelName = `tech-names-rt-${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const getName = useCallback(
    (email?: string | null) => {
      if (!email) return null;
      return map.get(email.toLowerCase()) ?? null;
    },
    [map]
  );

  return { nameMap: map, getName };
}

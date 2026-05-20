import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Devuelve un mapa { emailLower -> nombre amigable } para todos los
 * usuarios con rol `tecnico`. Se usa para mostrar el nombre del técnico
 * en lugar del correo en tablas, dashboards, historial, etc.
 *
 * La asignación interna sigue siendo el correo (campo
 * `entradas.assigned_technician`); este hook es solo para presentación.
 */
export function useTechnicianNames() {
  const [map, setMap] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "tecnico");
    const userIds = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));

    const [profsRes, dirRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("email,full_name,username").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("technicians").select("email,name"),
    ]);

    const m = new Map<string, string>();
    (profsRes.data ?? []).forEach((p: any) => {
      if (!p?.email) return;
      const key = p.email.toLowerCase();
      const name = p.full_name || p.username;
      if (name) m.set(key, name);
    });
    // El directorio `technicians` puede tener un nombre más cuidado
    (dirRes.data ?? []).forEach((d: any) => {
      if (!d?.email || !d?.name) return;
      m.set(d.email.toLowerCase(), d.name);
    });
    setMap(m);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("tech-names-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "technicians" }, () => load())
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

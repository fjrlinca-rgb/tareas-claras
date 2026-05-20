import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Technician {
  id: string;          // user_id (= profiles.id)
  email: string;
  name?: string | null;
  phone?: string | null;
  specialty?: string | null;
  active?: boolean;
  ticketCount?: number;       // tickets activos (no finalizados)
  ticketCountTotal?: number;  // tickets totales asignados
}

/**
 * Fuente ÚNICA de técnicos: usuarios con rol `tecnico` en user_roles.
 * Nombre/correo vienen de `profiles`. No se usa la tabla legacy `technicians`.
 * Si un usuario gana/pierde el rol técnico, se refleja en realtime.
 */
export function useTechnicians(enabled: boolean = true) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);

    // 1) Usuarios con rol técnico
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "tecnico");

    const userIds = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));

    if (userIds.length === 0) {
      setTechnicians([]);
      setLoading(false);
      return;
    }

    // 2) Perfiles + 3) conteo de tickets
    const [{ data: profs }, { data: tickets }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,username,active").in("id", userIds),
      supabase.from("entradas").select("assigned_technician,status"),
    ]);

    const counts = new Map<string, { active: number; total: number }>();
    (tickets ?? []).forEach((t: any) => {
      const k = (t.assigned_technician ?? "").toLowerCase();
      if (!k) return;
      const cur = counts.get(k) ?? { active: 0, total: 0 };
      cur.total += 1;
      if (t.status !== "finalizado") cur.active += 1;
      counts.set(k, cur);
    });

    const list: Technician[] = (profs ?? [])
      .filter((p: any) => p.email && p.active !== false)
      .map((p: any) => {
        const key = p.email.toLowerCase();
        const c = counts.get(key) ?? { active: 0, total: 0 };
        const name = p.full_name || p.username || null;
        return {
          id: p.id,
          email: p.email,
          name,
          phone: null,
          specialty: null,
          active: true,
          ticketCount: c.active,
          ticketCountTotal: c.total,
        };
      })
      .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));

    setTechnicians(list);
    setLoading(false);
  }, [enabled]);

  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  // Realtime: refrescar cuando cambien roles, perfiles o tickets.
  // Registrar TODOS los .on() ANTES de .subscribe() para evitar el error
  // "cannot add postgres_changes callbacks after subscribe()".
  useEffect(() => {
    if (!enabled) return;
    const channelName = `techs-rt-${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "entradas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [enabled, load]);

  return { technicians, loading, reload: load };
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Technician {
  id: string;          // user_id from auth/profiles
  email: string;
  name?: string | null;
  phone?: string | null;
  specialty?: string | null;
  active?: boolean;
  ticketCount?: number;       // tickets actualmente abiertos
  ticketCountTotal?: number;  // tickets totales asignados
}

/**
 * Fuente única de técnicos: usuarios con rol `tecnico` en user_roles.
 * Se enriquecen (nombre, teléfono, especialidad) desde la tabla `technicians`
 * usando el correo como clave, pero la lista NUNCA depende de esa tabla.
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

    // 2) Perfiles (correo) + 3) directorio opcional + 4) conteo de tickets
    const [{ data: profs }, { data: dir }, { data: tickets }] = await Promise.all([
      supabase.from("profiles").select("id,email").in("id", userIds),
      supabase.from("technicians").select("email,name,phone,specialty,active"),
      supabase.from("entradas").select("assigned_technician,status"),
    ]);

    const dirByEmail = new Map<string, any>();
    (dir ?? []).forEach((d: any) => {
      if (d?.email) dirByEmail.set(d.email.toLowerCase(), d);
    });

    const counts = new Map<string, { open: number; total: number }>();
    (tickets ?? []).forEach((t: any) => {
      const k = (t.assigned_technician ?? "").toLowerCase();
      if (!k) return;
      const cur = counts.get(k) ?? { open: 0, total: 0 };
      cur.total += 1;
      if (t.status !== "finalizado") cur.open += 1;
      counts.set(k, cur);
    });

    const list: Technician[] = (profs ?? [])
      .filter((p: any) => p.email)
      .map((p: any) => {
        const key = p.email.toLowerCase();
        const extra = dirByEmail.get(key);
        const c = counts.get(key) ?? { open: 0, total: 0 };
        return {
          id: p.id,
          email: p.email,
          name: extra?.name ?? null,
          phone: extra?.phone ?? null,
          specialty: extra?.specialty ?? null,
          active: extra?.active ?? true,
          ticketCount: c.open,
          ticketCountTotal: c.total,
        };
      })
      .filter((t) => t.active !== false)
      .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));

    setTechnicians(list);
    setLoading(false);
  }, [enabled]);

  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  // Realtime: refrescar cuando cambien roles, perfiles, directorio o tickets
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel("techs-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "technicians" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "entradas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [enabled, load]);

  return { technicians, loading, reload: load };
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Technician {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  specialty?: string | null;
  active?: boolean;
  source: "directory" | "role";
}

export function useTechnicians(enabled: boolean = true) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: dir }, { data: roles }] = await Promise.all([
      supabase.from("technicians").select("*").order("name", { ascending: true }),
      supabase.from("user_roles").select("user_id").eq("role", "tecnico"),
    ]);

    const byEmail = new Map<string, Technician>();
    (dir ?? []).forEach((t: any) => {
      if (!t.email) return;
      byEmail.set(t.email.toLowerCase(), {
        id: t.id,
        email: t.email,
        name: t.name,
        phone: t.phone,
        specialty: t.specialty,
        active: t.active,
        source: "directory",
      });
    });

    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id,email").in("id", ids);
      (profs ?? []).forEach((p: any) => {
        if (!p.email) return;
        const k = p.email.toLowerCase();
        if (!byEmail.has(k)) {
          byEmail.set(k, { id: p.id, email: p.email, active: true, source: "role" });
        }
      });
    }

    setTechnicians(
      Array.from(byEmail.values())
        .filter((t) => t.active !== false)
        .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))
    );
    setLoading(false);
  }, []);

  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  return { technicians, loading, reload: load };
}

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Suscripción realtime a una tabla. Por defecto `entradas` (tickets).
 * Para órdenes de trabajo pasar `"ordenes_trabajo"`.
 */
export function useRealtimeEntradas(onChange: () => void, table: string = "entradas") {
  useEffect(() => {
    const channel = supabase
      .channel(`${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onChange()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [onChange, table]);
}

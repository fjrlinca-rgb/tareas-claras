import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeEntradas(onChange: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`entradas-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entradas" },
        () => onChange()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [onChange]);
}

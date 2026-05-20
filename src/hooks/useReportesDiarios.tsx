import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ReporteDiario {
  id: string;
  fecha: string;
  total_tickets: number;
  pendientes: number;
  en_revision: number;
  en_proceso: number;
  finalizados: number;
  criticos: number;
  prioridad_baja: number;
  prioridad_media: number;
  prioridad_alta: number;
  prioridad_critica: number;
  tickets_creados: number;
  tickets_finalizados: number;
  tiempo_promedio_resolucion_horas: number;
  sla_cumplido_pct: number;
  tickets_por_tecnico: Array<{ email: string; nombre: string; total: number; finalizados: number; activos: number }>;
  tickets_por_empresa: Array<{ company_id: string; nombre: string; total: number }>;
  created_at: string;
}

export type RangoFiltro = "hoy" | "7d" | "30d" | "mes" | "anio";

function rangoFechas(r: RangoFiltro): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const d = new Date(today);
  if (r === "hoy") return { from: to, to };
  if (r === "7d") { d.setDate(d.getDate() - 6); return { from: d.toISOString().slice(0,10), to }; }
  if (r === "30d") { d.setDate(d.getDate() - 29); return { from: d.toISOString().slice(0,10), to }; }
  if (r === "mes") { const f = new Date(d.getFullYear(), d.getMonth(), 1); return { from: f.toISOString().slice(0,10), to }; }
  const f = new Date(d.getFullYear(), 0, 1); return { from: f.toISOString().slice(0,10), to };
}

export function useReportesDiarios(rango: RangoFiltro) {
  const [data, setData] = useState<ReporteDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = rangoFechas(rango);
    const { data: rows, error: err } = await supabase
      .from("reportes_diarios")
      .select("*")
      .gte("fecha", from)
      .lte("fecha", to)
      .order("fecha", { ascending: true });
    if (err) setError(err.message);
    else setData((rows ?? []) as unknown as ReporteDiario[]);
    setLoading(false);
  }, [rango]);

  const refrescarHoy = useCallback(async () => {
    await supabase.functions.invoke("snapshot-reportes");
    await load();
  }, [load]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load, refrescarHoy };
}

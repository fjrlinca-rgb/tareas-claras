import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ArrowRight, Plus, User2, FileText, AlertCircle, Activity } from "lucide-react";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/tickets";
import { useTechnicianNames } from "@/hooks/useTechnicianNames";
import { Skeleton } from "@/components/ui/skeleton";

interface HistoryRow {
  id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  created_at: string;
}

const FIELD_LABEL: Record<string, { label: string; icon: any }> = {
  status: { label: "Estado", icon: Activity },
  priority: { label: "Prioridad", icon: AlertCircle },
  assigned_technician: { label: "Técnico", icon: User2 },
  observations: { label: "Observaciones", icon: FileText },
};

const formatValue = (
  field: string | null,
  value: string | null,
  getTechnicianName?: (email?: string | null) => string | null
) => {
  if (!value) return <span className="italic text-muted-foreground">vacío</span>;
  if (field === "status") return STATUS_LABEL[value as keyof typeof STATUS_LABEL] ?? value;
  if (field === "priority") return PRIORITY_LABEL[value as keyof typeof PRIORITY_LABEL] ?? value;
  if (field === "observations") return value.length > 60 ? value.slice(0, 60) + "…" : value;
  if (field === "assigned_technician") {
    const name = getTechnicianName?.(value);
    return name ? (
      <span>
        {name} <span className="text-xs text-muted-foreground">({value})</span>
      </span>
    ) : value;
  }
  return value;
};

export const TicketHistory = ({ ticketId }: { ticketId: string }) => {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { getName: getTechnicianName } = useTechnicianNames();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ticket_history" as any)
        .select("id,action,field,old_value,new_value,changed_by_email,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (active) { setRows((data ?? []) as any); setLoading(false); }
    };
    load();
    const ch = supabase
      .channel(`ticket-history-${ticketId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_history", filter: `ticket_id=eq.${ticketId}` },
        () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [ticketId]);

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground italic">Sin actividad registrada.</p>;

  return (
    <ol className="relative border-l border-border ml-2 space-y-4">
      {rows.map((r) => {
        const meta = r.field ? FIELD_LABEL[r.field] : null;
        const Icon = r.action === "created" ? Plus : meta?.icon ?? Clock;
        return (
          <li key={r.id} className="pl-5 relative">
            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
            <div className="flex items-start gap-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                {r.action === "created" ? (
                  <p className="text-sm font-medium">Ticket creado</p>
                ) : (
                  <p className="text-sm">
                    <span className="font-medium">{meta?.label ?? r.field}</span>
                    {": "}
                    <span className="text-muted-foreground">{formatValue(r.field, r.old_value, getTechnicianName)}</span>
                    <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                    <span className="font-medium">{formatValue(r.field, r.new_value, getTechnicianName)}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.changed_by_email ?? "sistema"} · {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: es })}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

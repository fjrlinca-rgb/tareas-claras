import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket, PRIORITIES, STATUSES, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/tickets";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const Reportes = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  useEffect(() => {
    supabase.from("tickets").select("*").then(({ data }) => {
      setTickets((data ?? []) as Ticket[]);
      setLoading(false);
    });
  }, []);

  const total = tickets.length || 1;

  const byPriority = useMemo(() =>
    PRIORITIES.map(p => ({ key: p, label: PRIORITY_LABEL[p], count: tickets.filter(t => t.priority === p).length })),
    [tickets]
  );
  const byStatus = useMemo(() =>
    STATUSES.map(s => ({ key: s, label: STATUS_LABEL[s], count: tickets.filter(t => t.status === s).length })),
    [tickets]
  );

  const priorityColor: Record<string, string> = {
    baja: "bg-priority-baja",
    media: "bg-priority-media",
    alta: "bg-priority-alta",
    critica: "bg-priority-critica",
  };
  const statusColor: Record<string, string> = {
    pendiente: "bg-status-pendiente",
    en_proceso: "bg-status-proceso",
    finalizado: "bg-status-finalizado",
  };

  if (!user) return null;

  return (
    <AppLayout title="Reportes">
      <div className="space-y-6 max-w-[1400px]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Reportes de actividad</h2>
          <p className="text-muted-foreground text-sm mt-1">Distribución de tickets por prioridad y estado.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-6 shadow-card">
              <h3 className="font-semibold mb-4">Por prioridad</h3>
              <div className="space-y-4">
                {byPriority.map((row) => (
                  <div key={row.key}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span>{row.label}</span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${priorityColor[row.key]} transition-all`} style={{ width: `${(row.count / total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 shadow-card">
              <h3 className="font-semibold mb-4">Por estado</h3>
              <div className="space-y-4">
                {byStatus.map((row) => (
                  <div key={row.key}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span>{row.label}</span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${statusColor[row.key]} transition-all`} style={{ width: `${(row.count / total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        <Card className="p-6 shadow-card">
          <h3 className="font-semibold mb-1">Resumen global</h3>
          <p className="text-sm text-muted-foreground mb-4">Métricas clave del periodo actual.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-2xl font-semibold">{tickets.length}</p><p className="text-xs text-muted-foreground">Tickets totales</p></div>
            <div><p className="text-2xl font-semibold">{tickets.filter(t => t.status === "finalizado").length}</p><p className="text-xs text-muted-foreground">Resueltos</p></div>
            <div><p className="text-2xl font-semibold">{tickets.filter(t => t.status !== "finalizado").length}</p><p className="text-xs text-muted-foreground">Activos</p></div>
            <div><p className="text-2xl font-semibold">{tickets.filter(t => t.priority === "critica" && t.status !== "finalizado").length}</p><p className="text-xs text-muted-foreground">Críticos abiertos</p></div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Reportes;

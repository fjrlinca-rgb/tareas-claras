import { useEffect, useMemo, useState } from "react";
import { Users, Ticket as TicketIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket } from "@/lib/tickets";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const Tecnicos = () => {
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

  const grouped = useMemo(() => {
    const map = new Map<string, { total: number; activos: number }>();
    tickets.forEach((t) => {
      const name = t.assigned_technician?.trim() || "Sin asignar";
      const cur = map.get(name) ?? { total: 0, activos: 0 };
      cur.total += 1;
      if (t.status !== "finalizado") cur.activos += 1;
      map.set(name, cur);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [tickets]);

  if (!user) return null;

  return (
    <AppLayout title="Técnicos">
      <div className="space-y-6 max-w-[1400px]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Equipo de soporte</h2>
          <p className="text-muted-foreground text-sm mt-1">Carga de trabajo por técnico asignado.</p>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : grouped.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground shadow-card">
            Aún no hay tickets registrados.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.map(([name, stats]) => (
              <Card key={name} className="p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{name}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <TicketIcon className="h-3.5 w-3.5" /> {stats.total} totales
                      </span>
                      <span className="text-status-pendiente font-medium">{stats.activos} activos</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Tecnicos;

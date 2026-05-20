import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtimeEntradas } from "@/hooks/useRealtimeEntradas";
import { useNavigate } from "react-router-dom";
import { Plus, Clock, Loader2, CheckCircle2, AlertOctagon, Sparkles, ArrowRight, Eye, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { TicketsTable } from "@/components/TicketsTable";
import { TicketDialog, TicketFormValues } from "@/components/TicketDialog";
import { Ticket, formatDuracion } from "@/lib/tickets";
import { seedDemoTickets } from "@/lib/seed";
import { useTechnicianNames } from "@/hooks/useTechnicianNames";
import { toast } from "sonner";

const Dashboard = () => {
  const { user } = useAuth();
  const { primary: role, isSupervisor, isTecnico, isCliente } = useUserRole();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const { getName: getTechnicianName } = useTechnicianNames();

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("entradas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeEntradas(load);

  const stats = useMemo(() => ({
    pendiente: tickets.filter((t) => t.status === "pendiente").length,
    en_proceso: tickets.filter((t) => t.status === "en_proceso").length,
    en_revision: tickets.filter((t) => t.status === "en_revision").length,
    finalizado: tickets.filter((t) => t.status === "finalizado").length,
    critica: tickets.filter((t) => t.priority === "critica" && t.status !== "finalizado").length,
  }), [tickets]);

  const recent = useMemo(() => tickets.slice(0, 6), [tickets]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (t: Ticket) => { setEditing(t); setDialogOpen(true); };

  const isOnlyCliente = !isSupervisor && !isTecnico;

  const handleSave = async (values: TicketFormValues) => {
    if (editing) {
      const payload: any = { ...values };
      if (isOnlyCliente) { delete payload.status; delete payload.assigned_technician; delete payload.observations; }
      const { error } = await supabase.from("entradas").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Ticket actualizado");
    } else {
      const payload: any = isOnlyCliente
        ? { title: values.title, description: values.description, priority: values.priority, status: "pendiente", user_id: user!.id }
        : { ...values, user_id: user!.id };
      const { error } = await supabase.from("entradas").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Ticket creado");
    }
    await load();
  };

  const handleDelete = async (t: Ticket) => {
    if (!confirm(`¿Eliminar el ticket "${t.title}"?`)) return;
    const { error } = await supabase.from("entradas").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    setTickets((prev) => prev.filter((x) => x.id !== t.id));
    toast.success("Ticket eliminado");
  };

  const handleFinalize = async (t: Ticket) => {
    const { error } = await supabase.from("entradas").update({ status: "finalizado" }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket finalizado");
    await load();
  };

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedDemoTickets(user.id);
      toast.success("Datos de ejemplo cargados");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudieron cargar los datos");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6 animate-fade-in max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Panel de control</h2>
            <p className="text-muted-foreground text-sm mt-1">Resumen de la actividad de soporte técnico.</p>
          </div>
          <div className="flex gap-2">
            {isSupervisor && tickets.length === 0 && !loading && (
              <Button onClick={handleSeed} variant="outline" size="lg" disabled={seeding}>
                <Sparkles className="h-4 w-4 mr-1" /> {seeding ? "Cargando..." : "Cargar datos demo"}
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={() => navigate("/tickets")}>
              Ir a tickets <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Pendientes" value={stats.pendiente} icon={Clock} tone="warning" />
          <StatCard label="En proceso" value={stats.en_proceso} icon={Loader2} tone="primary" />
          <StatCard label="En revisión" value={stats.en_revision} icon={Eye} tone="review" />
          <StatCard label="Finalizados" value={stats.finalizado} icon={CheckCircle2} tone="success" />
          <StatCard label="Críticos activos" value={stats.critica} icon={AlertOctagon} tone="destructive" />
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Tickets recientes</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate("/tickets")}>
            Ver todos <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : recent.length === 0 ? (
          <Card className="p-12 text-center shadow-card">
            <p className="text-muted-foreground mb-4">Aún no hay tickets registrados.</p>
            <div className="flex justify-center gap-2">
              {isSupervisor && (
                <Button onClick={handleSeed} variant="outline" disabled={seeding}>
                  <Sparkles className="h-4 w-4 mr-1" /> Cargar datos demo
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate("/tickets")}>
                Ir a tickets <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </Card>
        ) : (
          <TicketsTable
            tickets={recent}
            role={role}
            onEdit={openEdit}
            onDelete={isSupervisor ? handleDelete : undefined}
            onFinalize={isSupervisor || isTecnico ? handleFinalize : undefined}
            getTechnicianName={getTechnicianName}
          />
        )}
      </div>

      <TicketDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSave} ticket={editing} role={role} />
    </AppLayout>
  );
};

export default Dashboard;

import { useEffect, useMemo, useState } from "react";
import { Plus, Clock, Loader2, CheckCircle2, AlertOctagon, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";
import { TicketsTable } from "@/components/TicketsTable";
import { TicketDialog } from "@/components/TicketDialog";
import { Ticket, Priority, Status, PRIORITIES, STATUSES, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/tickets";
import { toast } from "sonner";

const Dashboard = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const load = async () => {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    pendiente: tickets.filter((t) => t.status === "pendiente").length,
    en_proceso: tickets.filter((t) => t.status === "en_proceso").length,
    finalizado: tickets.filter((t) => t.status === "finalizado").length,
    critica: tickets.filter((t) => t.priority === "critica" && t.status !== "finalizado").length,
  }), [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q)
          || (t.description?.toLowerCase().includes(q) ?? false)
          || (t.assigned_technician?.toLowerCase().includes(q) ?? false);
      }
      return true;
    });
  }, [tickets, filterPriority, filterStatus, search]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (t: Ticket) => { setEditing(t); setDialogOpen(true); };

  const handleSave = async (values: {
    title: string; description: string | null; priority: Priority; status: Status; assigned_technician: string | null;
  }) => {
    if (editing) {
      const { error } = await supabase.from("tickets").update(values).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Ticket actualizado");
    } else {
      const { error } = await supabase.from("tickets").insert({ ...values, user_id: user!.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Ticket creado");
    }
    await load();
  };

  const handleDelete = async (t: Ticket) => {
    if (!confirm(`¿Eliminar el ticket "${t.title}"?`)) return;
    const { error } = await supabase.from("tickets").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    setTickets((prev) => prev.filter((x) => x.id !== t.id));
    toast.success("Ticket eliminado");
  };

  return (
    <AppLayout title="Mesa de ayuda">
      <div className="space-y-6 animate-fade-in max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Panel de tickets</h2>
            <p className="text-muted-foreground text-sm mt-1">Resumen de la actividad de soporte técnico.</p>
          </div>
          <Button onClick={openNew} size="lg" className="shadow-soft">
            <Plus className="h-4 w-4 mr-1" /> Crear ticket
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Pendientes" value={stats.pendiente} icon={Clock} tone="warning" />
          <StatCard label="En proceso" value={stats.en_proceso} icon={Loader2} tone="primary" />
          <StatCard label="Finalizados" value={stats.finalizado} icon={CheckCircle2} tone="success" />
          <StatCard label="Críticos activos" value={stats.critica} icon={AlertOctagon} tone="destructive" />
        </div>

        <Card className="p-4 shadow-card">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, descripción o técnico..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Prioridad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las prioridades</SelectItem>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : (
          <TicketsTable tickets={filtered} onEdit={openEdit} onDelete={handleDelete} />
        )}
      </div>

      <TicketDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSave} ticket={editing} />
    </AppLayout>
  );
};

export default Dashboard;

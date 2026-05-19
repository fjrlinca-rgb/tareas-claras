import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtimeEntradas } from "@/hooks/useRealtimeEntradas";
import { Plus, Search, ShieldCheck, Wrench, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TicketsTable } from "@/components/TicketsTable";
import { TicketDialog, TicketFormValues } from "@/components/TicketDialog";
import { Ticket, PRIORITIES, STATUSES, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/tickets";
import { toast } from "sonner";

const TicketsPage = () => {
  const { user } = useAuth();
  const { primary: role, isSupervisor, isTecnico, isCliente, loading: roleLoading } = useUserRole();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTechnician, setFilterTechnician] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

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

  const technicians = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach((t) => { if (t.assigned_technician) s.add(t.assigned_technician); });
    return Array.from(s).sort();
  }, [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterTechnician !== "all" && (t.assigned_technician ?? "__none__") !== filterTechnician) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q)
          || (t.description?.toLowerCase().includes(q) ?? false)
          || (t.assigned_technician?.toLowerCase().includes(q) ?? false);
      }
      return true;
    });
  }, [tickets, filterPriority, filterStatus, filterTechnician, search]);

  useEffect(() => { setPage(1); }, [search, filterPriority, filterStatus, filterTechnician]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage]
  );

  const canCreate = isCliente || isSupervisor;
  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (t: Ticket) => { setEditing(t); setDialogOpen(true); };

  const handleSave = async (values: TicketFormValues) => {
    if (editing) {
      const payload: any = { ...values };
      // Cliente nunca debería editar (no le mostramos botón), pero por seguridad bloqueamos cambios sensibles
      if (isCliente) {
        delete payload.status;
        delete payload.assigned_technician;
        delete payload.observations;
      }
      const { error } = await supabase.from("entradas").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Ticket actualizado");
    } else {
      // Crear: cliente fuerza pendiente y sin técnico
      const payload: any = isCliente
        ? {
            title: values.title,
            description: values.description,
            priority: values.priority,
            status: "pendiente",
            user_id: user!.id,
          }
        : { ...values, user_id: user!.id };
      const { error } = await supabase.from("entradas").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Ticket creado");
    }
    await load();
  };

  const handleDelete = async (t: Ticket) => {
    if (!isSupervisor) return;
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

  const roleLabel = isSupervisor
    ? { icon: ShieldCheck, label: "Supervisor", desc: "Gestión total de incidencias y asignación de técnicos." }
    : isTecnico
      ? { icon: Wrench, label: "Técnico", desc: "Tickets asignados a tu cuenta. Actualiza el estado al avanzar." }
      : { icon: User, label: "Cliente", desc: "Crea tickets de soporte. El equipo te asignará un técnico." };
  const RoleIcon = roleLabel.icon;

  return (
    <AppLayout title="Tickets">
      <div className="space-y-6 animate-fade-in max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
              <RoleIcon className="h-3.5 w-3.5" /> Vista de {roleLabel.label}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Gestión de tickets</h2>
            <p className="text-muted-foreground text-sm mt-1">{roleLabel.desc}</p>
          </div>
          {canCreate && (
            <Button onClick={openNew} size="lg" className="shadow-soft">
              <Plus className="h-4 w-4 mr-1" /> Crear ticket
            </Button>
          )}
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
            {isSupervisor && (
              <Select value={filterTechnician} onValueChange={setFilterTechnician}>
                <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Técnico" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los técnicos</SelectItem>
                  <SelectItem value="__none__">Sin asignar</SelectItem>
                  {technicians.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </Card>

        {loading || roleLoading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : (
          <>
            <TicketsTable
              tickets={paginated}
              role={role}
              onEdit={openEdit}
              onDelete={isSupervisor ? handleDelete : undefined}
              onFinalize={isSupervisor || isTecnico ? handleFinalize : undefined}
            />
            {filtered.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
                  <span className="px-2">Página {currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <TicketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        ticket={editing}
        role={role}
        technicianOptions={technicians}
      />
    </AppLayout>
  );
};

export default function Tickets() {
  return <RequireAuth><TicketsPage /></RequireAuth>;
}

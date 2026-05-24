import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useRealtimeEntradas } from "@/hooks/useRealtimeEntradas";
import { Plus, Search, ShieldCheck, Wrench, User, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCanCreateOrdenes } from "@/hooks/useCanCreateOrdenes";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TicketsTable } from "@/components/TicketsTable";
import { TicketDialog, TicketFormValues } from "@/components/TicketDialog";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useTechnicianNames } from "@/hooks/useTechnicianNames";
import {
  Ticket, PRIORITIES, PRIORITY_LABEL,
  STATUSES_OT, STATUS_LABEL,
  ORDEN_TIPOS, ORDEN_TIPO_LABEL,
} from "@/lib/tickets";
import { toast } from "sonner";

const TABLE = "ordenes_trabajo";

const OrdenesPage = () => {
  const { user } = useAuth();
  const { primary: role, isSupervisor, isTecnico, isCliente, loading: roleLoading } = useUserRole();
  const { enabled: canAccessOrdenes, loading: accessLoading } = useCanCreateOrdenes();
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterTechnician, setFilterTechnician] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from(TABLE as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as unknown as Ticket[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (canAccessOrdenes) load(); }, [load, canAccessOrdenes]);
  useRealtimeEntradas(load, TABLE);


  const { technicians: registeredTechs } = useTechnicians(isSupervisor);
  const { getName: getTechnicianName } = useTechnicianNames();

  const technicians = useMemo(() => {
    const s = new Set<string>();
    items.forEach((t) => { if (t.assigned_technician) s.add(t.assigned_technician); });
    registeredTechs.forEach((t) => s.add(t.email));
    return Array.from(s).sort();
  }, [items, registeredTechs]);

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterTipo !== "all" && (t.tipo ?? "otro") !== filterTipo) return false;
      if (filterTechnician !== "all" && (t.assigned_technician ?? "__none__") !== filterTechnician) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q)
          || (t.description?.toLowerCase().includes(q) ?? false)
          || (t.assigned_technician?.toLowerCase().includes(q) ?? false);
      }
      return true;
    });
  }, [items, filterPriority, filterStatus, filterTipo, filterTechnician, search]);

  useEffect(() => { setPage(1); }, [search, filterPriority, filterStatus, filterTipo, filterTechnician]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage]
  );

  const isOnlyCliente = !isSupervisor && !isTecnico;
  const canCreate = isSupervisor || (isOnlyCliente && canAccessOrdenes);
  const openNew = () => { setEditing(null); setDraftId(crypto.randomUUID()); setDialogOpen(true); };
  const openEdit = (t: Ticket) => { setEditing(t); setDraftId(null); setDialogOpen(true); };

  const handleSave = async (values: TicketFormValues) => {
    if (editing) {
      const payload: any = { ...values };
      if (isOnlyCliente) { delete payload.status; delete payload.assigned_technician; delete payload.observations; }
      const { error } = await supabase.from(TABLE as any).update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Orden actualizada");
    } else {
      const payload: any = isOnlyCliente
        ? {
            id: draftId ?? undefined,
            title: values.title,
            description: values.description,
            priority: values.priority,
            status: "pendiente",
            tipo: values.tipo ?? "otro",
            user_id: user!.id,
          }
        : { id: draftId ?? undefined, ...values, tipo: values.tipo ?? "otro", user_id: user!.id };
      const { error } = await supabase.from(TABLE as any).insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Orden creada");
    }
    await load();
  };

  const handleDelete = async (t: Ticket) => {
    if (!isSupervisor) return;
    if (!confirm(`¿Eliminar la orden "${t.title}"?`)) return;
    const { error } = await supabase.from(TABLE as any).delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.filter((x) => x.id !== t.id));
    toast.success("Orden eliminada");
  };

  const handleFinalize = async (t: Ticket) => {
    const { error } = await supabase.from(TABLE as any).update({ status: "finalizado" }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Orden finalizada");
    await load();
  };

  const roleLabel = isSupervisor
    ? { icon: ShieldCheck, label: "Supervisor", desc: "Gestiona la Orden de trabajo: mantenimientos, instalaciones y visitas." }
    : isTecnico
      ? { icon: Wrench, label: "Técnico", desc: "Orden de trabajo asignada a tu cuenta. Actualiza el estado al avanzar." }
      : { icon: User, label: "Empresa", desc: "Solicita una Orden de trabajo para tu empresa." };
  const RoleIcon = roleLabel.icon;

  // Bloqueo de acceso: si es cliente sin permiso, redirigir al inicio
  if (!roleLoading && !accessLoading && !canAccessOrdenes) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout title="Orden de trabajo">
      <div className="space-y-6 animate-fade-in max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
              <ClipboardList className="h-3.5 w-3.5" />
              <RoleIcon className="h-3.5 w-3.5" /> Vista de {roleLabel.label}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Orden de trabajo</h2>
            <p className="text-muted-foreground text-sm mt-1">{roleLabel.desc}</p>
          </div>
          {canCreate && (
            <Button onClick={openNew} size="lg" className="shadow-soft">
              <Plus className="h-4 w-4 mr-1" /> Crear Orden de trabajo
            </Button>
          )}
        </div>


        <Card className="p-4 shadow-card">
          <div className="flex flex-col md:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, descripción o técnico..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Prioridad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las prioridades</SelectItem>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full md:w-[170px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {ORDEN_TIPOS.map((t) => <SelectItem key={t} value={t}>{ORDEN_TIPO_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            {!isOnlyCliente && (
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-[170px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {STATUSES_OT.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {isSupervisor && (
              <Select value={filterTechnician} onValueChange={setFilterTechnician}>
                <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Técnico" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los técnicos</SelectItem>
                  <SelectItem value="__none__">Sin asignar</SelectItem>
                  {technicians.map((t) => {
                    const name = getTechnicianName(t);
                    return (
                      <SelectItem key={t} value={t}>
                        {name ? `${name} · ${t}` : t}
                      </SelectItem>
                    );
                  })}
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
              onAssign={isSupervisor ? openEdit : undefined}
              onDelete={isSupervisor ? handleDelete : undefined}
              onFinalize={isSupervisor || isTecnico ? handleFinalize : undefined}
              getTechnicianName={getTechnicianName}
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
        technicians={registeredTechs}
        tableName={TABLE}
        historyTable="historial_ordenes"
        historyIdField="orden_id"
        statuses={STATUSES_OT}
        showTipo
        entityLabel="orden de trabajo"
        attachmentsParentType="orden"
        draftId={draftId}
      />
    </AppLayout>
  );
};

export default function Ordenes() {
  return <RequireAuth><OrdenesPage /></RequireAuth>;
}

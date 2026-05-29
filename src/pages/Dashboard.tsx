import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtimeEntradas } from "@/hooks/useRealtimeEntradas";
import { useNavigate } from "react-router-dom";
import { Plus, Clock, Loader2, CheckCircle2, AlertOctagon, Sparkles, ArrowRight, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCanCreateOrdenes } from "@/hooks/useCanCreateOrdenes";
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
  const { enabled: canOrdenes } = useCanCreateOrdenes();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ordenes, setOrdenes] = useState<Ticket[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const { getName: getTechnicianName } = useTechnicianNames();

  const load = useCallback(async () => {
    const [tRes, oRes, aRes] = await Promise.all([
      supabase.from("entradas").select("*").order("created_at", { ascending: false }),
      supabase.from("ordenes_trabajo" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("actividades_tecnicas" as any).select("*").order("created_at", { ascending: false }),
    ]);
    if (tRes.error) toast.error(tRes.error.message);
    else setTickets((tRes.data ?? []) as Ticket[]);
    if (!oRes.error) setOrdenes((oRes.data ?? []) as unknown as Ticket[]);
    if (!aRes.error) setActividades((aRes.data ?? []) as any[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeEntradas(load);
  useRealtimeEntradas(load, "ordenes_trabajo");
  useRealtimeEntradas(load, "actividades_tecnicas");

  const stats = useMemo(() => {
    const finalizados = tickets.filter((t) => t.status === "finalizado");
    const tiempos = finalizados
      .map((t) => t.tiempo_resolucion_segundos ?? 0)
      .filter((s) => s > 0);
    const promedioSeg = tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;

    const otFinalizadas = ordenes.filter((o) => o.status === "finalizado");
    const otTiempos = otFinalizadas
      .map((o) => o.tiempo_resolucion_segundos ?? 0)
      .filter((s) => s > 0);
    const otPromedioSeg = otTiempos.length ? Math.round(otTiempos.reduce((a, b) => a + b, 0) / otTiempos.length) : 0;

    return {
      pendiente: tickets.filter((t) => t.status === "pendiente").length,
      en_proceso: tickets.filter((t) => t.status === "en_proceso").length,
      en_revision: tickets.filter((t) => t.status === "en_revision").length,
      finalizado: finalizados.length,
      critica: tickets.filter((t) => t.priority === "critica" && t.status !== "finalizado").length,
      tiempoPromedio: tiempos.length ? formatDuracion(promedioSeg) : "—",
      ot_proceso: ordenes.filter((o) => o.status === "en_proceso").length,
      ot_critica: ordenes.filter((o) => o.priority === "critica" && o.status !== "finalizado").length,
      ot_tiempoPromedio: otTiempos.length ? formatDuracion(otPromedioSeg) : "—",
      ot_pendiente: ordenes.filter((o) => o.status === "pendiente").length,
      ot_revision: ordenes.filter((o) => o.status === "en_revision").length,
      ot_finalizado: ordenes.filter((o) => o.status === "finalizado").length,
    };
  }, [tickets, ordenes]);

  const actStats = useMemo(() => {
    const today = new Date().toDateString();
    const activas = actividades.filter((a) => a.estado === "en_curso");
    const finalizadasHoy = actividades.filter(
      (a) => a.estado === "finalizada" && a.fecha_fin && new Date(a.fecha_fin).toDateString() === today
    );
    const segHoy = finalizadasHoy.reduce((acc, a) => acc + (a.tiempo_total_segundos ?? 0), 0);
    return {
      activas: activas.length,
      tecnicosTrabajando: new Set(activas.map((a) => a.tecnico_id)).size,
      finalizadasHoy: finalizadasHoy.length,
      horasHoy: (segHoy / 3600).toFixed(1) + "h",
    };
  }, [actividades]);

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

        {(isSupervisor || isTecnico || canOrdenes) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Orden de trabajo</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate("/ordenes")}>
                Ver Orden de trabajo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard label="OT pendientes" value={stats.ot_pendiente} icon={Clock} tone="warning" />
              <StatCard label="OT en proceso" value={stats.ot_proceso} icon={Loader2} tone="primary" />
              <StatCard label="OT en revisión" value={stats.ot_revision} icon={Eye} tone="review" />
              <StatCard label="OT finalizadas" value={stats.ot_finalizado} icon={CheckCircle2} tone="success" />
              <StatCard label="OT críticas activas" value={stats.ot_critica} icon={AlertOctagon} tone="destructive" />
            </div>
          </div>
        )}

        {(isSupervisor || isTecnico) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Actividades técnicas</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate("/actividades")}>
                Ver actividades <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard label="Técnicos trabajando" value={actStats.tecnicosTrabajando} icon={Users} tone="primary" />
              <StatCard label="Actividades activas" value={actStats.activas} icon={Activity} tone="warning" />
              <StatCard label="Horas trabajadas hoy" value={actStats.horasHoy} icon={Timer} tone="review" />
              <StatCard label="Finalizadas hoy" value={actStats.finalizadasHoy} icon={CheckCircle2} tone="success" />
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        )}
      </div>

      <TicketDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSave} ticket={editing} role={role} />
    </AppLayout>
  );
};

export default Dashboard;

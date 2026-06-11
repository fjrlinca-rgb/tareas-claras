import { useEffect, useMemo, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeEntradas } from "@/hooks/useRealtimeEntradas";
import {
  exportarTicketsExcel, exportarTicketsPDF, exportarOTExcel, exportarOTPDF,
  type ReporteRowTicket, type ReporteRowOT,
} from "@/lib/reportesExport";
import { PRIORITY_LABEL, STATUS_LABEL, ORDEN_TIPO_LABEL, formatDuracion, Priority, Status } from "@/lib/tickets";
import {
  Download, FileSpreadsheet, RefreshCw, AlertTriangle, CheckCircle2, Users, Inbox, Eye, Timer, Clock, Search,
} from "lucide-react";

/* ============================================================
 * Helpers
 * ============================================================ */

type RangoFiltro = "hoy" | "semana" | "mes" | "personalizado";

function rangoDesde(r: RangoFiltro, customFrom?: string): Date | null {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (r === "hoy") return d;
  if (r === "semana") { d.setDate(d.getDate() - 6); return d; }
  if (r === "mes") { d.setDate(d.getDate() - 29); return d; }
  if (r === "personalizado" && customFrom) return new Date(customFrom);
  return null;
}
function rangoHasta(r: RangoFiltro, customTo?: string): Date | null {
  if (r === "personalizado" && customTo) {
    const d = new Date(customTo); d.setHours(23, 59, 59, 999); return d;
  }
  return null;
}

const priorityBadge: Record<string, string> = {
  baja: "bg-priority-baja-soft text-priority-baja border-priority-baja/30",
  media: "bg-priority-media-soft text-priority-media border-priority-media/30",
  alta: "bg-priority-alta-soft text-priority-alta border-priority-alta/30",
  critica: "bg-priority-critica-soft text-priority-critica border-priority-critica/30",
};
const statusBadge: Record<string, string> = {
  pendiente: "bg-status-pendiente-soft text-status-pendiente border-status-pendiente/30",
  en_proceso: "bg-status-proceso-soft text-status-proceso border-status-proceso/30",
  en_revision: "bg-status-revision-soft text-status-revision border-status-revision/30",
  finalizado: "bg-status-finalizado-soft text-status-finalizado border-status-finalizado/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

const fmtFecha = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");
const fmtFechaCorta = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

/** Calcula tiempo total que un ticket pasó en un estado dado, usando ticket_history. */
function tiempoEnEstado(
  history: Array<{ field: string | null; old_value: string | null; new_value: string | null; created_at: string }>,
  createdAt: string,
  currentStatus: string,
  estado: string,
): number {
  // Construir transiciones de status ordenadas
  const transiciones = history
    .filter((h) => h.field === "status")
    .map((h) => ({ from: h.old_value ?? "pendiente", to: h.new_value ?? "pendiente", at: new Date(h.created_at).getTime() }))
    .sort((a, b) => a.at - b.at);

  let acumulado = 0;
  let inicio: number | null = null;

  // estado inicial al crear = pendiente
  let actual = "pendiente";
  let cursor = new Date(createdAt).getTime();

  if (actual === estado) inicio = cursor;

  for (const t of transiciones) {
    if (actual === estado && inicio !== null) {
      acumulado += Math.max(0, t.at - inicio);
      inicio = null;
    }
    actual = t.to;
    cursor = t.at;
    if (actual === estado) inicio = cursor;
  }

  // estado actual abierto
  if (actual === estado && inicio !== null && currentStatus !== "finalizado") {
    acumulado += Math.max(0, Date.now() - inicio);
  } else if (actual === estado && inicio !== null && currentStatus === "finalizado") {
    // si finalizó estando en este estado (raro), cerrar en último cursor
    acumulado += 0;
  }

  return Math.floor(acumulado / 1000);
}

/* ============================================================
 * KPI
 * ============================================================ */

const toneMap: Record<string, string> = {
  primary: "bg-status-proceso-soft text-status-proceso",
  success: "bg-status-finalizado-soft text-status-finalizado",
  warning: "bg-status-pendiente-soft text-status-pendiente",
  destructive: "bg-priority-critica-soft text-priority-critica",
  review: "bg-status-revision-soft text-status-revision",
  muted: "bg-muted text-muted-foreground",
};
const KPI = ({ label, value, icon: Icon, tone = "primary" }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof toneMap;
}) => (
  <Card className="p-3 shadow-card">
    <div className="flex items-center gap-2.5">
      <div className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${toneMap[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">{label}</p>
        <p className="text-xl font-semibold tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  </Card>
);

/* ============================================================
 * Página
 * ============================================================ */

interface Row {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: Status;
  assigned_technician: string | null;
  created_at: string;
  updated_at: string;
  fecha_inicio_revision?: string | null;
  fecha_finalizacion?: string | null;
  tiempo_resolucion_segundos?: number | null;
  tipo?: string | null;
  empresa?: string | null;
  empresa_id?: string | null;
  tecnico_nombre?: string | null;
  fecha_asignacion?: string | null;
  tiempo_revision_seg?: number;
  tiempo_proceso_seg?: number;
  adjuntos: number;
}

const Reportes = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Filtros comunes
  const [tab, setTab] = useState<"tickets" | "ordenes">("tickets");
  const [rango, setRango] = useState<RangoFiltro>("semana");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [fEmpresa, setFEmpresa] = useState<string>("__all");
  const [fTecnico, setFTecnico] = useState<string>("__all");
  const [fPrioridad, setFPrioridad] = useState<string>("__all");
  const [fEstado, setFEstado] = useState<string>("__all");
  const [fTipo, setFTipo] = useState<string>("__all");
  const [q, setQ] = useState<string>("");

  const [tickets, setTickets] = useState<Row[]>([]);
  const [ordenes, setOrdenes] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const desde = rangoDesde(rango, customFrom);
    const hasta = rangoHasta(rango, customTo);

    let qT = supabase.from("entradas").select("*").order("created_at", { ascending: false });
    let qO = supabase.from("ordenes_trabajo").select("*").order("created_at", { ascending: false });
    if (desde) { qT = qT.gte("created_at", desde.toISOString()); qO = qO.gte("created_at", desde.toISOString()); }
    if (hasta) { qT = qT.lte("created_at", hasta.toISOString()); qO = qO.lte("created_at", hasta.toISOString()); }

    const [{ data: tRows }, { data: oRows }] = await Promise.all([qT, qO]);
    const tRaw = (tRows ?? []) as any[];
    const oRaw = (oRows ?? []) as any[];

    // Enriquecer: empresas (vía profiles del owner) + nombres técnicos
    const userIds = [...new Set([...tRaw, ...oRaw].map((r) => r.user_id))];
    const emails = [...new Set([...tRaw, ...oRaw].map((r) => r.assigned_technician).filter(Boolean))] as string[];
    const ordenCompanyIds = [...new Set(oRaw.map((r) => r.company_id).filter(Boolean))] as string[];

    const [{ data: profs }, { data: techProfs }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, full_name, username, email, company_id").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      emails.length
        ? supabase.from("profiles").select("email, full_name, username").in("email", emails)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const companyIds = [
      ...new Set([
        ...((profs ?? []).map((p: any) => p.company_id).filter(Boolean) as string[]),
        ...ordenCompanyIds,
      ]),
    ];
    const { data: comps } = companyIds.length
      ? await supabase.from("companies").select("id, name").in("id", companyIds)
      : { data: [] as any[] };

    const profById = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
    const compById = new Map<string, any>((comps ?? []).map((c: any) => [c.id, c.name]));
    const tecByEmail = new Map<string, any>((techProfs ?? []).map((t: any) => [t.email, t.full_name || t.username || t.email]));

    // Historiales para calcular tiempos por estado + fechas de asignación
    const tIds = tRaw.map((r) => r.id);
    const oIds = oRaw.map((r) => r.id);

    const [{ data: tHist }, { data: oHist }, { data: tAttach }, { data: oAttach }] = await Promise.all([
      tIds.length
        ? supabase.from("ticket_history").select("ticket_id, field, old_value, new_value, created_at, action").in("ticket_id", tIds)
        : Promise.resolve({ data: [] as any[] }),
      oIds.length
        ? supabase.from("historial_ordenes").select("orden_id, field, old_value, new_value, created_at, action").in("orden_id", oIds)
        : Promise.resolve({ data: [] as any[] }),
      tIds.length
        ? supabase.from("attachments").select("parent_id").eq("parent_type", "ticket").in("parent_id", tIds)
        : Promise.resolve({ data: [] as any[] }),
      oIds.length
        ? supabase.from("attachments").select("parent_id").eq("parent_type", "orden").in("parent_id", oIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const histT = new Map<string, any[]>();
    (tHist ?? []).forEach((h: any) => {
      const arr = histT.get(h.ticket_id) ?? []; arr.push(h); histT.set(h.ticket_id, arr);
    });
    const histO = new Map<string, any[]>();
    (oHist ?? []).forEach((h: any) => {
      const arr = histO.get(h.orden_id) ?? []; arr.push(h); histO.set(h.orden_id, arr);
    });
    const attT = new Map<string, number>();
    (tAttach ?? []).forEach((a: any) => attT.set(a.parent_id, (attT.get(a.parent_id) ?? 0) + 1));
    const attO = new Map<string, number>();
    (oAttach ?? []).forEach((a: any) => attO.set(a.parent_id, (attO.get(a.parent_id) ?? 0) + 1));

    const fechaAsignacion = (history: any[]): string | null => {
      const evt = history
        .filter((h) => h.field === "assigned_technician" || h.action === "assigned_on_create")
        .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))[0];
      return evt ? evt.created_at : null;
    };

    const enrichTicket = (r: any): Row => {
      const p = profById.get(r.user_id);
      const h = histT.get(r.id) ?? [];
      return {
        ...r,
        empresa: p?.company_id ? (compById.get(p.company_id) ?? null) : null,
        empresa_id: p?.company_id ?? null,
        tecnico_nombre: r.assigned_technician ? (tecByEmail.get(r.assigned_technician) ?? r.assigned_technician) : null,
        fecha_asignacion: fechaAsignacion(h),
        tiempo_revision_seg: tiempoEnEstado(h, r.created_at, r.status, "en_revision"),
        tiempo_proceso_seg: tiempoEnEstado(h, r.created_at, r.status, "en_proceso"),
        adjuntos: attT.get(r.id) ?? 0,
      };
    };

    const enrichOrden = (r: any): Row => {
      const h = histO.get(r.id) ?? [];
      return {
        ...r,
        empresa: r.company_id ? (compById.get(r.company_id) ?? null) : null,
        empresa_id: r.company_id,
        tecnico_nombre: r.assigned_technician ? (tecByEmail.get(r.assigned_technician) ?? r.assigned_technician) : null,
        fecha_asignacion: fechaAsignacion(h),
        adjuntos: attO.get(r.id) ?? 0,
      };
    };

    setTickets(tRaw.map(enrichTicket));
    setOrdenes(oRaw.map(enrichOrden));
    setLoading(false);
  }, [rango, customFrom, customTo]);

  useEffect(() => { cargar(); }, [cargar]);

  // Realtime
  useRealtimeEntradas(cargar, "entradas");
  useRealtimeEntradas(cargar, "ordenes_trabajo");
  useRealtimeEntradas(cargar, "attachments");

  // Listas para filtros
  const dataset = tab === "tickets" ? tickets : ordenes;
  const empresas = useMemo(() => {
    const s = new Set<string>(); dataset.forEach((r) => { if (r.empresa) s.add(r.empresa); });
    return [...s].sort();
  }, [dataset]);
  const tecnicos = useMemo(() => {
    const m = new Map<string, string>();
    dataset.forEach((r) => { if (r.assigned_technician) m.set(r.assigned_technician, r.tecnico_nombre ?? r.assigned_technician); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [dataset]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return dataset.filter((r) => {
      if (fEmpresa !== "__all" && r.empresa !== fEmpresa) return false;
      if (fTecnico !== "__all" && r.assigned_technician !== fTecnico) return false;
      if (fPrioridad !== "__all" && r.priority !== fPrioridad) return false;
      if (fEstado !== "__all" && r.status !== fEstado) return false;
      if (tab === "ordenes" && fTipo !== "__all" && r.tipo !== fTipo) return false;
      if (ql) {
        const hay = [
          r.id, r.empresa, r.tecnico_nombre, r.assigned_technician, r.title, r.description,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [dataset, fEmpresa, fTecnico, fPrioridad, fEstado, fTipo, q, tab]);

  // KPIs sobre el dataset filtrado
  const kpis = useMemo(() => {
    const total = filtered.length;
    const pend = filtered.filter((t) => t.status === "pendiente").length;
    const rev = filtered.filter((t) => t.status === "en_revision").length;
    const fin = filtered.filter((t) => t.status === "finalizado").length;
    const crit = filtered.filter((t) => t.priority === "critica" && t.status !== "finalizado").length;
    const tecActivos = new Set(
      filtered.filter((t) => t.assigned_technician && t.status !== "finalizado").map((t) => t.assigned_technician),
    ).size;
    const tiempos = filtered
      .filter((t) => t.status === "finalizado")
      .map((t) => t.tiempo_resolucion_segundos ?? 0)
      .filter((s) => s > 0);
    const promedio = tiempos.length ? formatDuracion(Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)) : "—";
    return { total, pend, rev, fin, crit, tecActivos, promedio };
  }, [filtered]);

  // Filas listas para exportar
  const exportRowsTickets: ReporteRowTicket[] = useMemo(() => filtered.map((t) => ({
    id: t.id.slice(0, 8),
    empresa: t.empresa ?? "—",
    titulo: t.title,
    tecnico: t.tecnico_nombre ?? t.assigned_technician ?? "Sin asignar",
    prioridad: PRIORITY_LABEL[t.priority],
    estado: STATUS_LABEL[t.status],
    creado: fmtFecha(t.created_at),
    asignado: fmtFecha(t.fecha_asignacion),
    finalizado: fmtFecha(t.fecha_finalizacion),
    tiempo_resolucion: t.tiempo_resolucion_segundos ? formatDuracion(t.tiempo_resolucion_segundos) : "—",
    tiempo_revision: t.tiempo_revision_seg ? formatDuracion(t.tiempo_revision_seg) : "—",
    tiempo_proceso: t.tiempo_proceso_seg ? formatDuracion(t.tiempo_proceso_seg) : "—",
    adjuntos: t.adjuntos,
    actualizado: fmtFecha(t.updated_at),
  })), [filtered]);

  const exportRowsOT: ReporteRowOT[] = useMemo(() => filtered.map((o) => ({
    id: o.id.slice(0, 8),
    empresa: o.empresa ?? "—",
    tipo: o.tipo ? (ORDEN_TIPO_LABEL[o.tipo as keyof typeof ORDEN_TIPO_LABEL] ?? o.tipo) : "—",
    tecnico: o.tecnico_nombre ?? o.assigned_technician ?? "Sin asignar",
    prioridad: PRIORITY_LABEL[o.priority],
    estado: STATUS_LABEL[o.status],
    creado: fmtFecha(o.created_at),
    asignado: fmtFecha(o.fecha_asignacion),
    finalizado: fmtFecha(o.fecha_finalizacion),
    tiempo_resolucion: o.tiempo_resolucion_segundos ? formatDuracion(o.tiempo_resolucion_segundos) : "—",
    adjuntos: o.adjuntos,
    actualizado: fmtFecha(o.updated_at),
  })), [filtered]);

  if (!user) return null;

  return (
    <AppLayout title="Reportes">
      <div className="space-y-4 max-w-[1700px]">
        {/* Cabecera */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Consola operativa</h2>
            <p className="text-muted-foreground text-sm mt-1">Reportes en tiempo real de Tickets y Orden de trabajo.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }}
              disabled={refrescando}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refrescando ? "animate-spin" : ""}`} />
              Refrescar
            </Button>
            {tab === "tickets" ? (
              <>
                <Button variant="outline" size="sm" onClick={() => exportarTicketsExcel(exportRowsTickets)} disabled={!exportRowsTickets.length}>
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportarTicketsPDF(exportRowsTickets)} disabled={!exportRowsTickets.length}>
                  <Download className="h-4 w-4 mr-1.5" /> PDF
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => exportarOTExcel(exportRowsOT)} disabled={!exportRowsOT.length}>
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportarOTPDF(exportRowsOT)} disabled={!exportRowsOT.length}>
                  <Download className="h-4 w-4 mr-1.5" /> PDF
                </Button>
              </>
            )}
          </div>
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <KPI label="Totales" value={kpis.total} icon={Inbox} tone="primary" />
            <KPI label="Pendientes" value={kpis.pend} icon={Clock} tone="warning" />
            <KPI label="En revisión" value={kpis.rev} icon={Eye} tone="review" />
            <KPI label="Finalizados" value={kpis.fin} icon={CheckCircle2} tone="success" />
            <KPI label="Críticos" value={kpis.crit} icon={AlertTriangle} tone="destructive" />
            <KPI label="Técnicos activos" value={kpis.tecActivos} icon={Users} tone="muted" />
          </div>
        )}

        {/* Tabs + filtros */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as "tickets" | "ordenes")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="tickets">Tickets</TabsTrigger>
              <TabsTrigger value="ordenes">Orden de trabajo</TabsTrigger>
            </TabsList>

            {/* Filtros de rango */}
            <div className="flex items-center gap-2">
              <Tabs value={rango} onValueChange={(v) => setRango(v as RangoFiltro)}>
                <TabsList>
                  <TabsTrigger value="hoy">Hoy</TabsTrigger>
                  <TabsTrigger value="semana">Semana</TabsTrigger>
                  <TabsTrigger value="mes">Mes</TabsTrigger>
                  <TabsTrigger value="personalizado">Personalizado</TabsTrigger>
                </TabsList>
              </Tabs>
              {rango === "personalizado" && (
                <>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-[150px]" />
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-[150px]" />
                </>
              )}
            </div>
          </div>

          {/* Filtros secundarios + búsqueda */}
          <Card className="p-3 mt-3 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar por ID, empresa, técnico, título o descripción…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 h-9" />
              </div>
              <Select value={fEmpresa} onValueChange={setFEmpresa}>
                <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas las empresas</SelectItem>
                  {empresas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fTecnico} onValueChange={setFTecnico}>
                <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Técnico" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos los técnicos</SelectItem>
                  {tecnicos.map(([email, nombre]) => <SelectItem key={email} value={email}>{nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fPrioridad} onValueChange={setFPrioridad}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Prioridad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Toda prioridad</SelectItem>
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fEstado} onValueChange={setFEstado}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todo estado</SelectItem>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              {tab === "ordenes" && (
                <Select value={fTipo} onValueChange={setFTipo}>
                  <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Tipo OT" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todo tipo</SelectItem>
                    {Object.entries(ORDEN_TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </Card>

          {/* Tabla tickets */}
          <TabsContent value="tickets" className="mt-3">
            <Card className="shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold">Reporte de tickets</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{filtered.length} registros</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[90px]">ID</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead>Asignado</TableHead>
                      <TableHead>Finalizado</TableHead>
                      <TableHead>T. resolución</TableHead>
                      <TableHead>T. revisión</TableHead>
                      <TableHead>T. proceso</TableHead>
                      <TableHead className="text-center">Adj.</TableHead>
                      <TableHead>Actualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={14}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-10">Sin tickets que coincidan.</TableCell></TableRow>
                    ) : (
                      filtered.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">#{t.id.slice(0, 8)}</TableCell>
                          <TableCell className="font-medium truncate max-w-[160px]">{t.empresa ?? <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="truncate max-w-[260px]">{t.title}</TableCell>
                          <TableCell className="truncate max-w-[180px]">{t.tecnico_nombre ?? <span className="text-muted-foreground italic">Sin asignar</span>}</TableCell>
                          <TableCell><Badge variant="outline" className={priorityBadge[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className={statusBadge[t.status]}>{STATUS_LABEL[t.status]}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">{fmtFechaCorta(t.created_at)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">{fmtFechaCorta(t.fecha_asignacion)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">{fmtFechaCorta(t.fecha_finalizacion)}</TableCell>
                          <TableCell className="text-xs tabular-nums">{t.tiempo_resolucion_segundos ? formatDuracion(t.tiempo_resolucion_segundos) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs tabular-nums">{t.tiempo_revision_seg ? formatDuracion(t.tiempo_revision_seg) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs tabular-nums">{t.tiempo_proceso_seg ? formatDuracion(t.tiempo_proceso_seg) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-center tabular-nums">{t.adjuntos || <span className="text-muted-foreground">0</span>}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">{fmtFechaCorta(t.updated_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Tabla órdenes */}
          <TabsContent value="ordenes" className="mt-3">
            <Card className="shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold">Reporte de Orden de trabajo</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{filtered.length} registros</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[90px]">ID OT</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead>Asignado</TableHead>
                      <TableHead>Finalizado</TableHead>
                      <TableHead>T. resolución</TableHead>
                      <TableHead className="text-center">Adj.</TableHead>
                      <TableHead>Actualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={12}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-10">Sin órdenes que coincidan.</TableCell></TableRow>
                    ) : (
                      filtered.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">#{o.id.slice(0, 8)}</TableCell>
                          <TableCell className="font-medium truncate max-w-[160px]">{o.empresa ?? <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs">{o.tipo ? (ORDEN_TIPO_LABEL[o.tipo as keyof typeof ORDEN_TIPO_LABEL] ?? o.tipo) : "—"}</TableCell>
                          <TableCell className="truncate max-w-[180px]">{o.tecnico_nombre ?? <span className="text-muted-foreground italic">Sin asignar</span>}</TableCell>
                          <TableCell><Badge variant="outline" className={priorityBadge[o.priority]}>{PRIORITY_LABEL[o.priority]}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className={statusBadge[o.status]}>{STATUS_LABEL[o.status]}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">{fmtFechaCorta(o.created_at)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">{fmtFechaCorta(o.fecha_asignacion)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">{fmtFechaCorta(o.fecha_finalizacion)}</TableCell>
                          <TableCell className="text-xs tabular-nums">{o.tiempo_resolucion_segundos ? formatDuracion(o.tiempo_resolucion_segundos) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-center tabular-nums">{o.adjuntos || <span className="text-muted-foreground">0</span>}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">{fmtFechaCorta(o.updated_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Reportes;

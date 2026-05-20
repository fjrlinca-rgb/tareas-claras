import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useReportesDiarios, RangoFiltro } from "@/hooks/useReportesDiarios";
import { exportarExcel, exportarPDF } from "@/lib/reportesExport";
import { Ticket, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/tickets";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area,
} from "recharts";
import {
  Download, FileSpreadsheet, RefreshCw, AlertTriangle, CheckCircle2, Users, Inbox, Eye, Clock,
} from "lucide-react";

interface KpiProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "warning" | "destructive" | "muted" | "review";
}
const toneMap: Record<string, string> = {
  primary: "bg-status-proceso-soft text-status-proceso",
  success: "bg-status-finalizado-soft text-status-finalizado",
  warning: "bg-status-pendiente-soft text-status-pendiente",
  destructive: "bg-priority-critica-soft text-priority-critica",
  review: "bg-status-revision-soft text-status-revision",
  muted: "bg-muted text-muted-foreground",
};
const KPI = ({ label, value, icon: Icon, tone = "primary" }: KpiProps) => (
  <Card className="p-4 shadow-card">
    <div className="flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${toneMap[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium truncate">{label}</p>
        <p className="text-2xl font-semibold tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  </Card>
);

function rangoDesde(r: RangoFiltro): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (r === "hoy") return d;
  if (r === "7d") { d.setDate(d.getDate() - 6); return d; }
  d.setDate(d.getDate() - 29);
  return d;
}

function tiempoAbierto(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m`;
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
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
};

interface TicketRow extends Ticket {
  empresa?: string | null;
  cliente?: string | null;
}

const Reportes = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rango, setRango] = useState<RangoFiltro>("7d");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const { data: historico, refrescarHoy } = useReportesDiarios("30d");

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  const cargar = async () => {
    setLoading(true);
    const desde = rangoDesde(rango).toISOString();
    const { data: ents } = await supabase
      .from("entradas")
      .select("*")
      .gte("created_at", desde)
      .order("created_at", { ascending: false });

    const rows = (ents ?? []) as Ticket[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const emails = [...new Set(rows.map((r) => r.assigned_technician).filter(Boolean) as string[])];

    const [{ data: profs }, { data: techProfs }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, full_name, username, email, company_id").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      emails.length
        ? supabase.from("profiles").select("email, full_name, username").in("email", emails)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const companyIds = [...new Set((profs ?? []).map((p: any) => p.company_id).filter(Boolean))];
    const { data: comps } = companyIds.length
      ? await supabase.from("companies").select("id, name").in("id", companyIds)
      : { data: [] as any[] };

    const profById = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const compById = new Map((comps ?? []).map((c: any) => [c.id, c.name]));
    const tecByEmail = new Map((techProfs ?? []).map((t: any) => [t.email, t.full_name || t.username || t.email]));

    const enriched: TicketRow[] = rows.map((r) => {
      const p = profById.get(r.user_id);
      return {
        ...r,
        empresa: p?.company_id ? compById.get(p.company_id) ?? null : null,
        cliente: p?.full_name || p?.username || p?.email || null,
        assigned_technician: r.assigned_technician
          ? (tecByEmail.get(r.assigned_technician) ?? r.assigned_technician)
          : r.assigned_technician,
      };
    });

    setTickets(enriched);
    setLoading(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [rango]);

  // KPIs sobre el periodo
  const kpis = useMemo(() => {
    const total = tickets.length;
    const pend = tickets.filter((t) => t.status === "pendiente").length;
    const rev = tickets.filter((t) => t.status === "en_revision").length;
    const fin = tickets.filter((t) => t.status === "finalizado").length;
    const crit = tickets.filter((t) => t.priority === "critica" && t.status !== "finalizado").length;
    const tecActivos = new Set(
      tickets.filter((t) => t.assigned_technician && t.status !== "finalizado").map((t) => t.assigned_technician),
    ).size;
    return { total, pend, rev, fin, crit, tecActivos };
  }, [tickets]);

  // Top técnicos
  const topTecnicos = useMemo(() => {
    const map = new Map<string, { nombre: string; resueltos: number; activos: number }>();
    tickets.forEach((t) => {
      if (!t.assigned_technician) return;
      const key = t.assigned_technician;
      const cur = map.get(key) ?? { nombre: key, resueltos: 0, activos: 0 };
      if (t.status === "finalizado") cur.resueltos += 1;
      else cur.activos += 1;
      map.set(key, cur);
    });
    return [...map.values()]
      .map((v) => ({ ...v, carga: v.resueltos + v.activos }))
      .sort((a, b) => b.carga - a.carga)
      .slice(0, 6);
  }, [tickets]);

  // Top empresas
  const topEmpresas = useMemo(() => {
    const map = new Map<string, number>();
    tickets.forEach((t) => {
      const k = t.empresa ?? "Sin empresa";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return [...map.entries()]
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [tickets]);

  // Serie histórica solo si hay suficiente
  const hayHistorico = historico.length >= 7;
  const serie = historico.map((r) => ({
    fecha: r.fecha.slice(5),
    creados: r.tickets_creados,
    finalizados: r.tickets_finalizados,
    criticos: r.criticos,
  }));

  if (!user) return null;

  return (
    <AppLayout title="Reportes">
      <div className="space-y-5 max-w-[1600px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Reportes de actividad</h2>
            <p className="text-muted-foreground text-sm mt-1">Vista operativa estilo NOC/SOC.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={rango} onValueChange={(v) => setRango(v as RangoFiltro)}>
              <TabsList>
                <TabsTrigger value="hoy">Hoy</TabsTrigger>
                <TabsTrigger value="7d">Semana</TabsTrigger>
                <TabsTrigger value="30d">Mes</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline" size="sm"
              onClick={async () => { setRefrescando(true); await Promise.all([cargar(), refrescarHoy()]); setRefrescando(false); }}
              disabled={refrescando}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refrescando ? "animate-spin" : ""}`} />
              Refrescar
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportarExcel(historico)} disabled={!historico.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportarPDF(historico)} disabled={!historico.length}>
              <Download className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPI label="Tickets totales" value={kpis.total} icon={Inbox} tone="primary" />
            <KPI label="Pendientes" value={kpis.pend} icon={Clock} tone="warning" />
            <KPI label="En revisión" value={kpis.rev} icon={Eye} tone="review" />
            <KPI label="Finalizados" value={kpis.fin} icon={CheckCircle2} tone="success" />
            <KPI label="Críticos" value={kpis.crit} icon={AlertTriangle} tone="destructive" />
            <KPI label="Técnicos activos" value={kpis.tecActivos} icon={Users} tone="muted" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Top técnicos</h3>
              <span className="text-xs text-muted-foreground">Carga actual</span>
            </div>
            {topTecnicos.length ? (
              <div className="space-y-2.5">
                {topTecnicos.map((t) => {
                  const max = topTecnicos[0].carga || 1;
                  const pct = Math.round((t.carga / max) * 100);
                  return (
                    <div key={t.nombre}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate">{t.nombre}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {t.resueltos} resueltos · {t.activos} activos
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-status-proceso" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin técnicos con tickets en este periodo.</p>
            )}
          </Card>

          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Top empresas</h3>
              <span className="text-xs text-muted-foreground">Más incidencias</span>
            </div>
            {topEmpresas.length ? (
              <div className="space-y-2.5">
                {topEmpresas.map((e) => {
                  const max = topEmpresas[0].total || 1;
                  const pct = Math.round((e.total / max) * 100);
                  return (
                    <div key={e.nombre}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate">{e.nombre}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">{e.total}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-priority-alta" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin incidencias en este periodo.</p>
            )}
          </Card>
        </div>

        <Card className="shadow-card overflow-hidden">
          <div className="p-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Resumen de tickets</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{tickets.length} en el periodo</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Tiempo abierto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                  ))
                ) : tickets.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Sin tickets en el periodo.</TableCell></TableRow>
                ) : (
                  tickets.slice(0, 50).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.empresa ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{t.assigned_technician ?? <span className="text-muted-foreground">Sin asignar</span>}</TableCell>
                      <TableCell><Badge variant="outline" className={priorityBadge[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={statusBadge[t.status]}>{STATUS_LABEL[t.status]}</Badge></TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.status === "finalizado" ? <span className="text-muted-foreground">—</span> : tiempoAbierto(t.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {hayHistorico && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 shadow-card">
              <h3 className="font-semibold mb-1">Tickets creados vs finalizados</h3>
              <p className="text-xs text-muted-foreground mb-3">Últimos 30 días</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Line type="monotone" dataKey="creados" stroke="hsl(var(--status-proceso))" strokeWidth={2} name="Creados" />
                  <Line type="monotone" dataKey="finalizados" stroke="hsl(var(--status-finalizado))" strokeWidth={2} name="Finalizados" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5 shadow-card">
              <h3 className="font-semibold mb-1">Tendencia de críticos</h3>
              <p className="text-xs text-muted-foreground mb-3">Últimos 30 días</p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Area type="monotone" dataKey="criticos" stroke="hsl(var(--priority-critica))" fill="hsl(var(--priority-critica))" fillOpacity={0.25} name="Críticos" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Reportes;

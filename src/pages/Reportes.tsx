import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useReportesDiarios, RangoFiltro } from "@/hooks/useReportesDiarios";
import { exportarExcel, exportarPDF } from "@/lib/reportesExport";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Download, FileSpreadsheet, RefreshCw, TrendingUp, Clock, AlertTriangle, CheckCircle2, Users, Building2, Target } from "lucide-react";

const COLORS = {
  pendiente: "hsl(35 95% 50%)",
  proceso: "hsl(215 90% 52%)",
  revision: "hsl(200 90% 45%)",
  finalizado: "hsl(145 60% 42%)",
  critica: "hsl(0 78% 52%)",
  alta: "hsl(30 95% 50%)",
  media: "hsl(215 90% 52%)",
  baja: "hsl(215 15% 50%)",
};

interface KpiProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "warning" | "destructive" | "muted";
}

const KPI = ({ label, value, hint, icon: Icon, tone = "primary" }: KpiProps) => {
  const tones: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    destructive: "bg-priority-critica-soft text-priority-critica",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-semibold mt-1 tabular-nums truncate">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
        </div>
        <div className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
};

const Reportes = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rango, setRango] = useState<RangoFiltro>("30d");
  const { data, loading, refrescarHoy } = useReportesDiarios(rango);
  const [refrescando, setRefrescando] = useState(false);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  // Asegurar snapshot del día actual la primera vez
  useEffect(() => {
    (async () => {
      setRefrescando(true);
      await refrescarHoy();
      setRefrescando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ultimo = data[data.length - 1];

  const kpis = useMemo(() => {
    const totalCreados = data.reduce((s, r) => s + r.tickets_creados, 0);
    const totalFinalizados = data.reduce((s, r) => s + r.tickets_finalizados, 0);
    const tasa = totalCreados ? Math.round((totalFinalizados / totalCreados) * 100) : 0;
    const tecMap = new Map<string, { nombre: string; total: number }>();
    const empMap = new Map<string, { nombre: string; total: number }>();
    data.forEach((r) => {
      (r.tickets_por_tecnico ?? []).forEach((t) => {
        const cur = tecMap.get(t.email) ?? { nombre: t.nombre, total: 0 };
        tecMap.set(t.email, { nombre: t.nombre, total: Math.max(cur.total, t.total) });
      });
      (r.tickets_por_empresa ?? []).forEach((e) => {
        const cur = empMap.get(e.company_id) ?? { nombre: e.nombre, total: 0 };
        empMap.set(e.company_id, { nombre: e.nombre, total: Math.max(cur.total, e.total) });
      });
    });
    const topTec = [...tecMap.values()].sort((a, b) => b.total - a.total)[0];
    const topEmp = [...empMap.values()].sort((a, b) => b.total - a.total)[0];
    return {
      totalCreados,
      totalFinalizados,
      tasa,
      criticos: ultimo?.criticos ?? 0,
      tiempoProm: ultimo?.tiempo_promedio_resolucion_horas ?? 0,
      sla: ultimo?.sla_cumplido_pct ?? 0,
      topTec,
      topEmp,
    };
  }, [data, ultimo]);

  const serieDiaria = data.map((r) => ({
    fecha: r.fecha.slice(5),
    creados: r.tickets_creados,
    finalizados: r.tickets_finalizados,
    pendientes: r.pendientes,
    proceso: r.en_proceso,
    revision: r.en_revision,
    fin: r.finalizados,
    criticos: r.criticos,
  }));

  const cargaTecnico = (ultimo?.tickets_por_tecnico ?? [])
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((t) => ({ nombre: t.nombre?.split(" ")[0] ?? t.email, total: t.total, finalizados: t.finalizados, activos: t.activos }));

  const distPrioridad = ultimo
    ? [
        { name: "Baja", value: ultimo.prioridad_baja, color: COLORS.baja },
        { name: "Media", value: ultimo.prioridad_media, color: COLORS.media },
        { name: "Alta", value: ultimo.prioridad_alta, color: COLORS.alta },
        { name: "Crítica", value: ultimo.prioridad_critica, color: COLORS.critica },
      ]
    : [];

  if (!user) return null;

  return (
    <AppLayout title="Reportes">
      <div className="space-y-6 max-w-[1600px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Reportes de actividad</h2>
            <p className="text-muted-foreground text-sm mt-1">Histórico diario con KPIs, tendencias y exportación.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={rango} onValueChange={(v) => setRango(v as RangoFiltro)}>
              <TabsList>
                <TabsTrigger value="hoy">Hoy</TabsTrigger>
                <TabsTrigger value="7d">7 días</TabsTrigger>
                <TabsTrigger value="30d">30 días</TabsTrigger>
                <TabsTrigger value="mes">Mes</TabsTrigger>
                <TabsTrigger value="anio">Año</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => { setRefrescando(true); await refrescarHoy(); setRefrescando(false); }}
              disabled={refrescando}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refrescando ? "animate-spin" : ""}`} />
              Refrescar
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportarExcel(data)} disabled={!data.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportarPDF(data)} disabled={!data.length}>
              <Download className="h-4 w-4 mr-1.5" />
              PDF
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI label="Tickets creados (periodo)" value={kpis.totalCreados} icon={TrendingUp} tone="primary" />
              <KPI label="Finalizados (periodo)" value={kpis.totalFinalizados} hint={`${kpis.tasa}% de resolución`} icon={CheckCircle2} tone="success" />
              <KPI label="Tiempo prom. resolución" value={`${Number(kpis.tiempoProm).toFixed(1)} h`} icon={Clock} tone="primary" />
              <KPI label="Críticos abiertos" value={kpis.criticos} icon={AlertTriangle} tone="destructive" />
              <KPI label="SLA cumplido" value={`${Number(kpis.sla).toFixed(1)}%`} icon={Target} tone={kpis.sla >= 80 ? "success" : "warning"} />
              <KPI label="Técnico con más tickets" value={kpis.topTec?.nombre ?? "—"} hint={kpis.topTec ? `${kpis.topTec.total} tickets` : ""} icon={Users} tone="primary" />
              <KPI label="Empresa con más incidencias" value={kpis.topEmp?.nombre ?? "—"} hint={kpis.topEmp ? `${kpis.topEmp.total} tickets` : ""} icon={Building2} tone="warning" />
              <KPI label="Días con historial" value={data.length} icon={TrendingUp} tone="muted" />
            </div>

            {!data.length ? (
              <Card className="p-10 text-center text-muted-foreground">
                Aún no hay snapshots históricos. El sistema generará uno automáticamente al cierre del día,
                o puedes presionar «Refrescar» para crear el de hoy.
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="p-6 shadow-card">
                    <h3 className="font-semibold mb-1">Tickets creados vs finalizados</h3>
                    <p className="text-xs text-muted-foreground mb-4">Movimiento por día</p>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={serieDiaria}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                        <Legend />
                        <Line type="monotone" dataKey="creados" stroke={COLORS.proceso} strokeWidth={2} name="Creados" />
                        <Line type="monotone" dataKey="finalizados" stroke={COLORS.finalizado} strokeWidth={2} name="Finalizados" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="p-6 shadow-card">
                    <h3 className="font-semibold mb-1">Tendencia de incidencias críticas</h3>
                    <p className="text-xs text-muted-foreground mb-4">Críticos abiertos por día</p>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={serieDiaria}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                        <Area type="monotone" dataKey="criticos" stroke={COLORS.critica} fill={COLORS.critica} fillOpacity={0.25} name="Críticos" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="p-6 shadow-card lg:col-span-2">
                    <h3 className="font-semibold mb-1">Estados por día</h3>
                    <p className="text-xs text-muted-foreground mb-4">Distribución acumulada</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={serieDiaria}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                        <Legend />
                        <Bar dataKey="pendientes" stackId="a" fill={COLORS.pendiente} name="Pendientes" />
                        <Bar dataKey="proceso" stackId="a" fill={COLORS.proceso} name="En proceso" />
                        <Bar dataKey="revision" stackId="a" fill={COLORS.revision} name="En revisión" />
                        <Bar dataKey="fin" stackId="a" fill={COLORS.finalizado} name="Finalizados" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="p-6 shadow-card">
                    <h3 className="font-semibold mb-1">Por prioridad (actual)</h3>
                    <p className="text-xs text-muted-foreground mb-4">Snapshot más reciente</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={distPrioridad} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                          {distPrioridad.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                <Card className="p-6 shadow-card">
                  <h3 className="font-semibold mb-1">Carga por técnico</h3>
                  <p className="text-xs text-muted-foreground mb-4">Distribución actual (top 8)</p>
                  {cargaTecnico.length ? (
                    <ResponsiveContainer width="100%" height={Math.max(220, cargaTecnico.length * 38)}>
                      <BarChart data={cargaTecnico} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis type="category" dataKey="nombre" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                        <Legend />
                        <Bar dataKey="activos" stackId="t" fill={COLORS.proceso} name="Activos" />
                        <Bar dataKey="finalizados" stackId="t" fill={COLORS.finalizado} name="Finalizados" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin datos de técnicos en este periodo.</p>
                  )}
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Reportes;

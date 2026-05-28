import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AttachmentsField } from "@/components/AttachmentsField";
import { StatCard } from "@/components/StatCard";
import { Plus, PlayCircle, CheckCircle2, Clock, Activity, Users, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Estado = "en_curso" | "finalizada";

const TIPOS = [
  "desarrollo", "investigacion", "curso", "capacitacion",
  "documentacion", "configuracion", "laboratorio", "monitoreo", "otro",
] as const;

const TIPO_LABEL: Record<string, string> = {
  desarrollo: "Desarrollo",
  investigacion: "Investigación",
  curso: "Curso",
  capacitacion: "Capacitación",
  documentacion: "Documentación",
  configuracion: "Configuración",
  laboratorio: "Laboratorio",
  monitoreo: "Monitoreo",
  otro: "Otro",
};

interface Actividad {
  id: string;
  tecnico_id: string;
  tecnico_email: string | null;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  observaciones: string | null;
  estado: Estado;
  fecha_inicio: string;
  fecha_fin: string | null;
  tiempo_total_segundos: number | null;
  tiempo_total_texto: string | null;
  created_at: string;
}

function formatDuracion(seg: number): string {
  if (!seg || seg < 0) return "—";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}

const Actividades = () => {
  const { user } = useAuth();
  const { isSupervisor, isTecnico } = useUserRole();
  const [items, setItems] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detail, setDetail] = useState<Actividad | null>(null);
  const [form, setForm] = useState({ titulo: "", descripcion: "", tipo: "otro", observaciones: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("actividades_tecnicas" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as unknown as Actividad[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`actividades-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "actividades_tecnicas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);


  const canCreate = isTecnico;

  const handleCreate = async () => {
    if (!user || !form.titulo.trim()) { toast.error("Título requerido"); return; }
    setSaving(true);
    const { data, error } = await (supabase
      .from("actividades_tecnicas" as any)
      .insert({
        tecnico_id: user.id,
        tecnico_email: user.email ?? null,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        tipo: form.tipo,
        observaciones: form.observaciones.trim() || null,
        estado: "en_curso",
      })
      .select("*")
      .single() as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Actividad iniciada");
    setForm({ titulo: "", descripcion: "", tipo: "otro", observaciones: "" });
    setDialogOpen(false);
    setDetail(data as Actividad);
  };

  const handleFinalize = async (a: Actividad) => {
    const { error } = await supabase
      .from("actividades_tecnicas" as any)
      .update({ estado: "finalizada" })
      .eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Actividad finalizada");
    if (detail?.id === a.id) setDetail(null);
  };

  const handleDelete = async (a: Actividad) => {
    if (!confirm(`¿Eliminar "${a.titulo}"?`)) return;
    const { error } = await supabase.from("actividades_tecnicas" as any).delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminada");
  };

  const fmtHora = (d: string | null) => (d ? format(new Date(d), "HH:mm") : "—");
  const fmtFecha = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");

  return (
    <AppLayout title="Actividades técnicas">
      <div className="space-y-6 animate-fade-in max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Monitoreo operativo técnico</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Registro de actividades cuando no hay tickets u órdenes de trabajo asignadas.
            </p>
          </div>
          {canCreate && (
            <Button size="lg" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva actividad
            </Button>
          )}
        </div>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {isSupervisor ? "Todas las actividades" : "Mis actividades"}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {isSupervisor && <TableHead>Técnico</TableHead>}
                  <TableHead>Actividad</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Tiempo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin actividades registradas.</TableCell></TableRow>
                ) : items.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => setDetail(a)}>
                    {isSupervisor && <TableCell className="text-xs">{a.tecnico_email ?? "—"}</TableCell>}
                    <TableCell className="font-medium">{a.titulo}</TableCell>
                    <TableCell><Badge variant="outline">{TIPO_LABEL[a.tipo] ?? a.tipo}</Badge></TableCell>
                    <TableCell className="text-xs tabular-nums">{fmtHora(a.fecha_inicio)}</TableCell>
                    <TableCell className="text-xs tabular-nums">{fmtHora(a.fecha_fin)}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {a.tiempo_total_texto ?? (a.tiempo_total_segundos ? formatDuracion(a.tiempo_total_segundos) : "—")}
                    </TableCell>
                    <TableCell>
                      {a.estado === "en_curso" ? (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15">
                          <PlayCircle className="h-3 w-3 mr-1" /> En curso
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Finalizada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{fmtFecha(a.fecha_inicio)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {a.estado === "en_curso" && (a.tecnico_id === user?.id || isSupervisor) && (
                        <Button size="sm" variant="outline" onClick={() => handleFinalize(a)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Finalizar
                        </Button>
                      )}
                      {(isSupervisor || (a.tecnico_id === user?.id && a.estado === "en_curso")) && (
                        <Button size="sm" variant="ghost" className="ml-1" onClick={() => handleDelete(a)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Crear actividad */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva actividad técnica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Configuración de laboratorio…" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de actividad</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea rows={4} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observaciones internas</Label>
              <Textarea rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Los adjuntos se podrán agregar al abrir la actividad después de crearla.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              <PlayCircle className="h-4 w-4 mr-1" /> Iniciar actividad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.titulo}
                  <Badge variant="outline">{TIPO_LABEL[detail.tipo] ?? detail.tipo}</Badge>
                  {detail.estado === "en_curso" ? (
                    <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">En curso</Badge>
                  ) : (
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Finalizada</Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md border p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Inicio</div>
                    <div className="font-medium tabular-nums">{fmtFecha(detail.fecha_inicio)} · {fmtHora(detail.fecha_inicio)}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Fin</div>
                    <div className="font-medium tabular-nums">{detail.fecha_fin ? `${fmtFecha(detail.fecha_fin)} · ${fmtHora(detail.fecha_fin)}` : "—"}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Tiempo total</div>
                    <div className="font-medium tabular-nums">
                      {detail.tiempo_total_texto ?? (detail.tiempo_total_segundos ? formatDuracion(detail.tiempo_total_segundos) : "—")}
                    </div>
                  </div>
                </div>
                {detail.descripcion && (
                  <div>
                    <Label className="text-xs uppercase text-muted-foreground">Descripción</Label>
                    <p className="text-sm whitespace-pre-wrap mt-1">{detail.descripcion}</p>
                  </div>
                )}
                {detail.observaciones && (
                  <div>
                    <Label className="text-xs uppercase text-muted-foreground">Observaciones</Label>
                    <p className="text-sm whitespace-pre-wrap mt-1">{detail.observaciones}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Adjuntos</Label>
                  <div className="mt-2">
                    <AttachmentsField
                      parentType="actividad"
                      parentId={detail.id}
                      readOnly={detail.tecnico_id !== user?.id && !isSupervisor}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                {detail.estado === "en_curso" && (detail.tecnico_id === user?.id || isSupervisor) && (
                  <Button onClick={() => handleFinalize(detail)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Finalizar actividad
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetail(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Actividades;

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Plus, Pencil, Trash2, Mail, Phone, Wrench, Search, ShieldOff, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface TechRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  active: boolean;
}

const emptyForm = { name: "", email: "", phone: "", specialty: "", active: true };

const Tecnicos = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSupervisor, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const [rows, setRows] = useState<TechRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { total: number; activos: number }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TechRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    const [{ data: techs, error }, { data: tickets }] = await Promise.all([
      supabase.from("technicians").select("*").order("name"),
      supabase.from("entradas").select("assigned_technician,status"),
    ]);
    if (error) toast.error(error.message);
    setRows((techs ?? []) as TechRow[]);
    const map: Record<string, { total: number; activos: number }> = {};
    (tickets ?? []).forEach((t: any) => {
      const k = (t.assigned_technician ?? "").toLowerCase();
      if (!k) return;
      const cur = map[k] ?? { total: 0, activos: 0 };
      cur.total += 1;
      if (t.status !== "finalizado") cur.activos += 1;
      map[k] = cur;
    });
    setCounts(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("technicians-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "technicians" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "entradas" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.specialty ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    activos: rows.filter((r) => r.active).length,
    inactivos: rows.filter((r) => !r.active).length,
  }), [rows]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: TechRow) => {
    setEditing(r);
    setForm({ name: r.name, email: r.email, phone: r.phone ?? "", specialty: r.specialty ?? "", active: r.active });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { toast.error("Nombre y correo son obligatorios"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      specialty: form.specialty.trim() || null,
      active: form.active,
    };
    if (editing) {
      const { error } = await supabase.from("technicians").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Técnico actualizado");
    } else {
      const { error } = await supabase.from("technicians").insert({ ...payload, created_by: user!.id });
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Técnico agregado");
    }
    setSaving(false);
    setDialogOpen(false);
    await load();
  };

  const handleDelete = async (r: TechRow) => {
    if (!confirm(`¿Eliminar al técnico "${r.name}"? Los tickets ya asignados no se modificarán.`)) return;
    const { error } = await supabase.from("technicians").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Técnico eliminado");
    await load();
  };

  const toggleActive = async (r: TechRow) => {
    const { error } = await supabase.from("technicians").update({ active: !r.active }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(!r.active ? "Técnico activado" : "Técnico desactivado");
  };

  if (!user) return null;

  return (
    <AppLayout title="Técnicos">
      <div className="space-y-6 max-w-[1400px] animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
              <Wrench className="h-3.5 w-3.5" /> Mesa de ayuda
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Directorio de técnicos</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Administra el equipo disponible para asignar tickets de soporte.
            </p>
          </div>
          {isSupervisor && (
            <Button size="lg" onClick={openNew} className="shadow-soft">
              <Plus className="h-4 w-4 mr-1" /> Nuevo técnico
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 shadow-card">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Total</p>
            <p className="text-3xl font-semibold mt-1">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Users className="h-3 w-3" /> Registrados</p>
          </Card>
          <Card className="p-5 shadow-card">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Activos</p>
            <p className="text-3xl font-semibold mt-1 text-status-finalizado">{stats.activos}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Disponibles para asignación</p>
          </Card>
          <Card className="p-5 shadow-card">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Inactivos</p>
            <p className="text-3xl font-semibold mt-1 text-muted-foreground">{stats.inactivos}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><ShieldOff className="h-3 w-3" /> No aparecen en el selector</p>
          </Card>
        </div>

        <Card className="p-4 shadow-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, correo o especialidad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="shadow-card overflow-hidden">
          {loading || roleLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {rows.length === 0
                ? "Aún no hay técnicos. Agrega el primero con \"Nuevo técnico\"."
                : "Ningún técnico coincide con la búsqueda."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Carga</TableHead>
                  <TableHead>Estado</TableHead>
                  {isSupervisor && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const c = counts[r.email.toLowerCase()] ?? { total: 0, activos: 0 };
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-status-pendiente/15 text-status-pendiente grid place-items-center font-medium">
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{r.name}</p>
                            <p className="text-xs text-muted-foreground">{r.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" /> {r.email}</span>
                          {r.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" /> {r.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.specialty || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{c.activos}</span>
                        <span className="text-muted-foreground"> / {c.total}</span>
                      </TableCell>
                      <TableCell>
                        {r.active ? (
                          <Badge className="bg-status-finalizado/15 text-status-finalizado hover:bg-status-finalizado/15">Activo</Badge>
                        ) : (
                          <Badge variant="secondary">Inactivo</Badge>
                        )}
                      </TableCell>
                      {isSupervisor && (
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} aria-label="Activar/Desactivar" />
                            <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar técnico" : "Nuevo técnico"}</DialogTitle>
            <DialogDescription>
              Los técnicos activos aparecen en el selector "Técnico asignado" de los tickets.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="t-name">Nombre completo *</Label>
              <Input id="t-name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-email">Correo electrónico *</Label>
              <Input id="t-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <p className="text-xs text-muted-foreground">Debe coincidir con el correo de inicio de sesión del técnico para que pueda ver sus tickets.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="t-phone">Teléfono</Label>
                <Input id="t-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="099 999 9999" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-spec">Especialidad</Label>
                <Input id="t-spec" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Redes, Hardware..." />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Activo</Label>
                <p className="text-xs text-muted-foreground">Aparece en el selector de asignación.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Guardando..." : editing ? "Guardar" : "Agregar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default function TecnicosPage() {
  return <RequireAuth><Tecnicos /></RequireAuth>;
}

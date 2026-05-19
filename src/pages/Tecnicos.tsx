import { useMemo, useState } from "react";
import { Users, Mail, Phone, Wrench, Search, ShieldOff, ShieldCheck, Info } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useUserRole } from "@/hooks/useUserRole";

const Tecnicos = () => {
  const { isSupervisor } = useUserRole();
  const { technicians, loading } = useTechnicians(true);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return technicians;
    return technicians.filter((r) =>
      (r.name ?? "").toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.specialty ?? "").toLowerCase().includes(q)
    );
  }, [technicians, search]);

  const stats = useMemo(() => ({
    total: technicians.length,
    activos: technicians.filter((r) => r.active !== false).length,
    inactivos: technicians.filter((r) => r.active === false).length,
    cargaTotal: technicians.reduce((s, t) => s + (t.ticketCount ?? 0), 0),
  }), [technicians]);

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
              Vista de solo lectura. Los técnicos se crean desde <span className="font-medium">Usuarios → Crear usuario</span> seleccionando el rol <span className="font-medium">Técnico</span>.
            </p>
          </div>
        </div>

        {isSupervisor && (
          <Card className="p-4 shadow-card border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3 text-sm">
              <Info className="h-4 w-4 mt-0.5 text-primary" />
              <p className="text-muted-foreground">
                Esta lista se sincroniza automáticamente con los usuarios que tienen el rol <span className="font-medium text-foreground">tecnico</span>.
                Para agregar, editar o desactivar un técnico, gestiona el usuario correspondiente en el módulo <span className="font-medium text-foreground">Usuarios</span>.
              </p>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-5 shadow-card">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Total</p>
            <p className="text-3xl font-semibold mt-1">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Users className="h-3 w-3" /> Con rol técnico</p>
          </Card>
          <Card className="p-5 shadow-card">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Activos</p>
            <p className="text-3xl font-semibold mt-1 text-status-finalizado">{stats.activos}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Disponibles para asignación</p>
          </Card>
          <Card className="p-5 shadow-card">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Inactivos</p>
            <p className="text-3xl font-semibold mt-1 text-muted-foreground">{stats.inactivos}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><ShieldOff className="h-3 w-3" /> Ocultos del selector</p>
          </Card>
          <Card className="p-5 shadow-card">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Carga abierta</p>
            <p className="text-3xl font-semibold mt-1 text-status-pendiente">{stats.cargaTotal}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Wrench className="h-3 w-3" /> Tickets en curso</p>
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
          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {technicians.length === 0
                ? "Aún no hay usuarios con rol técnico. Crea uno desde Usuarios → Crear usuario."
                : "Ningún técnico coincide con la búsqueda."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Carga (abiertos / total)</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const display = r.name || r.email;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-status-pendiente/15 text-status-pendiente grid place-items-center font-medium">
                            {display.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{display}</p>
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
                        <span className="font-medium">{r.ticketCount ?? 0}</span>
                        <span className="text-muted-foreground"> / {r.ticketCountTotal ?? 0}</span>
                      </TableCell>
                      <TableCell>
                        {r.active !== false ? (
                          <Badge className="bg-status-finalizado/15 text-status-finalizado hover:bg-status-finalizado/15">Activo</Badge>
                        ) : (
                          <Badge variant="secondary">Inactivo</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default function TecnicosPage() {
  return <RequireAuth><Tecnicos /></RequireAuth>;
}

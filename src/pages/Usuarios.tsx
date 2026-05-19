import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Wrench, User as UserIcon, Search, Users as UsersIcon, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface ProfileRow { id: string; email: string | null; created_at: string; }
interface UserItem extends ProfileRow { roles: AppRole[]; primary: AppRole; }

const ROLE_LABEL: Record<AppRole, string> = { cliente: "Cliente", tecnico: "Técnico", supervisor: "Supervisor" };
const ROLE_ICON = { cliente: UserIcon, tecnico: Wrench, supervisor: ShieldCheck } as const;
const ROLE_BADGE: Record<AppRole, string> = {
  cliente: "bg-primary-soft text-primary border border-primary/20",
  tecnico: "bg-status-pendiente-soft text-status-pendiente border border-status-pendiente/20",
  supervisor: "bg-status-finalizado-soft text-status-finalizado border border-status-finalizado/20",
};
const ROLE_DOT: Record<AppRole, string> = {
  cliente: "bg-primary",
  tecnico: "bg-status-pendiente",
  supervisor: "bg-status-finalizado",
};

const primaryOf = (roles: AppRole[]): AppRole =>
  roles.includes("supervisor") ? "supervisor" : roles.includes("tecnico") ? "tecnico" : "cliente";

const UsuariosPage = () => {
  const { user } = useAuth();
  const { isSupervisor, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabase.from("profiles").select("id,email,created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    if (pErr) toast.error(pErr.message);
    if (rErr) toast.error(rErr.message);
    const rolesByUser = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    });
    const items: UserItem[] = (profiles ?? []).map((p: any) => {
      const rs = rolesByUser.get(p.id) ?? ["cliente"];
      return { ...p, roles: rs, primary: primaryOf(rs) };
    });
    setUsers(items);
    setLoading(false);
  }, []);

  useEffect(() => { if (isSupervisor) load(); }, [isSupervisor, load]);

  const changeRole = async (u: UserItem, newRole: AppRole) => {
    if (u.id === user?.id && u.primary === "supervisor" && newRole !== "supervisor") {
      if (!confirm("Vas a quitarte tu propio rol de supervisor. Perderás acceso al panel. ¿Continuar?")) return;
    }
    setUpdating(u.id);
    // Replace all roles with the single new role
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", u.id);
    if (delErr) { toast.error(delErr.message); setUpdating(null); return; }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: u.id, role: newRole });
    if (insErr) { toast.error(insErr.message); setUpdating(null); return; }
    toast.success(`Rol actualizado a ${ROLE_LABEL[newRole]}`);
    setUpdating(null);
    await load();
  };

  const filtered = useMemo(() => users.filter((u) => {
    if (filter !== "all" && u.primary !== filter) return false;
    if (search && !(u.email ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [users, filter, search]);

  const counts = useMemo(() => ({
    total: users.length,
    cliente: users.filter((u) => u.primary === "cliente").length,
    tecnico: users.filter((u) => u.primary === "tecnico").length,
    supervisor: users.filter((u) => u.primary === "supervisor").length,
  }), [users]);

  if (roleLoading) {
    return <AppLayout title="Usuarios"><Skeleton className="h-32" /></AppLayout>;
  }

  if (!isSupervisor) {
    return (
      <AppLayout title="Usuarios">
        <Card className="p-12 text-center shadow-card max-w-lg mx-auto">
          <AlertTriangle className="h-10 w-10 mx-auto text-status-pendiente mb-3" />
          <h2 className="text-lg font-semibold mb-1">Acceso restringido</h2>
          <p className="text-sm text-muted-foreground">Esta sección está disponible únicamente para supervisores.</p>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Usuarios">
      <div className="space-y-6 animate-fade-in max-w-[1400px]">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Panel de administración
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Gestión de usuarios y roles</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Cambia el rol de cada usuario. Los nuevos registros se crean como <strong>cliente</strong> automáticamente.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total", value: counts.total, icon: UsersIcon, tone: "text-foreground" },
            { label: "Clientes", value: counts.cliente, icon: UserIcon, tone: "text-muted-foreground" },
            { label: "Técnicos", value: counts.tecnico, icon: Wrench, tone: "text-primary" },
            { label: "Supervisores", value: counts.supervisor, icon: ShieldCheck, tone: "text-status-finalizado" },
          ].map((s) => (
            <Card key={s.label} className="p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-semibold mt-1">{s.value}</p>
                </div>
                <s.icon className={`h-5 w-5 ${s.tone}`} />
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-4 shadow-card">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full md:w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="cliente">Clientes</SelectItem>
                <SelectItem value="tecnico">Técnicos</SelectItem>
                <SelectItem value="supervisor">Supervisores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : (
          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Usuario</TableHead>
                    <TableHead className="w-[140px]">Rol actual</TableHead>
                    <TableHead className="w-[220px]">Cambiar rol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No se encontraron usuarios.</TableCell></TableRow>
                  ) : filtered.map((u) => {
                    const Icon = ROLE_ICON[u.primary];
                    const isSelf = u.id === user?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-muted grid place-items-center shrink-0">
                              <UserIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{u.email ?? "(sin email)"}</p>
                              <p className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}{isSelf && " · tú"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-muted">
                            <Icon className="h-3 w-3" /> {ROLE_LABEL[u.primary]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select value={u.primary} disabled={updating === u.id} onValueChange={(v) => changeRole(u, v as AppRole)}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cliente">Cliente</SelectItem>
                              <SelectItem value="tecnico">Técnico</SelectItem>
                              <SelectItem value="supervisor">Supervisor</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default function Usuarios() {
  return <RequireAuth><UsuariosPage /></RequireAuth>;
}

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck, Wrench, Building2, Search, Users as UsersIcon, AlertTriangle,
  UserPlus, RefreshCw, KeyRound, Pencil, Trash2, Power, PowerOff, Plus, Briefcase,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface CompanyRow { id: string; name: string; contact: string | null; email: string | null; active: boolean; created_at: string; }
interface ProfileRow {
  id: string; email: string | null; created_at: string;
  full_name: string | null; username: string | null; company_id: string | null; active: boolean;
}
interface UserItem extends ProfileRow { roles: AppRole[]; primary: AppRole; company_name?: string | null; }

const ROLE_LABEL: Record<AppRole, string> = { cliente: "Empresa", tecnico: "Técnico", supervisor: "Supervisor" };
const ROLE_ICON = { cliente: Building2, tecnico: Wrench, supervisor: ShieldCheck } as const;
const ROLE_BADGE: Record<AppRole, string> = {
  cliente: "bg-primary-soft text-primary border border-primary/20",
  tecnico: "bg-status-pendiente-soft text-status-pendiente border border-status-pendiente/20",
  supervisor: "bg-status-finalizado-soft text-status-finalizado border border-status-finalizado/20",
};
const ROLE_DOT: Record<AppRole, string> = {
  cliente: "bg-primary", tecnico: "bg-status-pendiente", supervisor: "bg-status-finalizado",
};
const primaryOf = (roles: AppRole[]): AppRole =>
  roles.includes("supervisor") ? "supervisor" : roles.includes("tecnico") ? "tecnico" : "cliente";
const genPassword = () => {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = ""; for (let i = 0; i < 12; i++) p += c[Math.floor(Math.random() * c.length)];
  return p + "!" + Math.floor(Math.random() * 90 + 10);
};

// ---------- User dialog (create / edit) ----------
function UserDialog({
  open, onOpenChange, companies, editing, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  companies: CompanyRow[]; editing: UserItem | null; onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(genPassword());
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<AppRole>("cliente");
  const [companyId, setCompanyId] = useState<string>("none");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setFullName(editing.full_name ?? "");
        setEmail(editing.email ?? "");
        setUsername(editing.username ?? "");
        setPassword(""); setConfirm("");
        setRole(editing.primary);
        setCompanyId(editing.company_id ?? "none");
        setActive(editing.active);
      } else {
        setFullName(""); setEmail(""); setUsername("");
        setPassword(genPassword()); setConfirm("");
        setRole("cliente"); setCompanyId("none"); setActive(true);
      }
    }
  }, [open, editing]);

  const submit = async () => {
    if (!email) return toast.error("El correo es obligatorio");
    if (!isEdit || password) {
      if (password.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres");
      if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    }
    setBusy(true);
    const payload: Record<string, unknown> = {
      email, full_name: fullName, username: username || null,
      company_id: companyId === "none" ? null : companyId,
      role, active,
    };
    if (password) payload.password = password;

    let res;
    if (isEdit) {
      res = await supabase.functions.invoke("admin-update-user", {
        body: { action: "update", user_id: editing!.id, ...payload },
      });
    } else {
      res = await supabase.functions.invoke("admin-create-user", { body: payload });
    }
    setBusy(false);
    const err = (res.data as any)?.error ?? res.error?.message;
    if (err) return toast.error(err);
    toast.success(isEdit ? "Usuario actualizado" : `Usuario creado · contraseña: ${password}`);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {isEdit ? "Editar usuario" : "Crear nuevo usuario"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifica los datos del usuario seleccionado." : "Completa los datos para registrar una nueva cuenta."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Correo</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Usuario</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mlopez" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" />
                {isEdit ? "Nueva contraseña" : "Contraseña"}
              </Label>
              <div className="flex gap-2">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" placeholder={isEdit ? "(dejar vacío)" : ""} />
                <Button type="button" variant="outline" size="icon" onClick={() => setPassword(genPassword())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar contraseña</Label>
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="font-mono" placeholder={isEdit ? "(dejar vacío)" : ""} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Empresa</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Estado de la cuenta</Label>
              <p className="text-xs text-muted-foreground">Los usuarios inactivos no podrán iniciar sesión.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${active ? "text-status-finalizado" : "text-muted-foreground"}`}>
                {active ? "Activo" : "Inactivo"}
              </span>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear usuario"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Company dialog ----------
function CompanyDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: CompanyRow | null; onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [name, setName] = useState(""); const [contact, setContact] = useState("");
  const [email, setEmail] = useState(""); const [username, setUsername] = useState("");
  const [password, setPassword] = useState(genPassword()); const [confirm, setConfirm] = useState("");
  const [active, setActive] = useState(true); const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name); setContact(editing.contact ?? ""); setEmail(editing.email ?? "");
        setUsername(""); setPassword(""); setConfirm(""); setActive(editing.active);
      } else {
        setName(""); setContact(""); setEmail(""); setUsername("");
        setPassword(genPassword()); setConfirm(""); setActive(true);
      }
    }
  }, [open, editing]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Nombre de empresa requerido");
    if (isEdit) {
      setBusy(true);
      const { error } = await supabase.from("companies").update({
        name, contact: contact || null, email: email || null, active,
      }).eq("id", editing!.id);
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Empresa actualizada");
      onOpenChange(false); onSaved(); return;
    }
    if (!email) return toast.error("Correo requerido");
    if (password.length < 8) return toast.error("Contraseña mínima de 8 caracteres");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    setBusy(true);
    const res = await supabase.functions.invoke("admin-create-company", {
      body: { name, contact, email, username, password, active },
    });
    setBusy(false);
    const err = (res.data as any)?.error ?? res.error?.message;
    if (err) return toast.error(err);
    toast.success(`Empresa creada · contraseña: ${password}`);
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            {isEdit ? "Editar empresa" : "Crear nueva empresa"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifica los datos de la empresa." : "Se creará la empresa y su usuario de acceso con rol Empresa."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Nombre de empresa</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme S.A." />
            </div>
            <div className="space-y-1.5">
              <Label>Contacto</Label>
              <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Persona / teléfono" />
            </div>
            <div className="space-y-1.5">
              <Label>Correo</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@acme.com" disabled={isEdit} />
            </div>
            {!isEdit && (
              <>
                <div className="space-y-1.5">
                  <Label>Usuario</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="acme" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Contraseña</Label>
                  <div className="flex gap-2">
                    <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
                    <Button type="button" variant="outline" size="icon" onClick={() => setPassword(genPassword())}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Confirmar contraseña</Label>
                  <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="font-mono" />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Estado</Label>
              <p className="text-xs text-muted-foreground">Las empresas inactivas no pueden iniciar sesión.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${active ? "text-status-finalizado" : "text-muted-foreground"}`}>
                {active ? "Activo" : "Inactivo"}
              </span>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear empresa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main ----------
const UsuariosPage = () => {
  const { user } = useAuth();
  const { isSupervisor, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const [userDlg, setUserDlg] = useState<{ open: boolean; editing: UserItem | null }>({ open: false, editing: null });
  const [coDlg, setCoDlg] = useState<{ open: boolean; editing: CompanyRow | null }>({ open: false, editing: null });
  const [delUser, setDelUser] = useState<UserItem | null>(null);
  const [delCo, setDelCo] = useState<CompanyRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: cos }] = await Promise.all([
      supabase.from("profiles").select("id,email,created_at,full_name,username,company_id,active").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("companies").select("id,name,contact,email,active,created_at").order("created_at", { ascending: false }),
    ]);
    const rolesBy = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesBy.get(r.user_id) ?? []; arr.push(r.role as AppRole); rolesBy.set(r.user_id, arr);
    });
    const coMap = new Map((cos ?? []).map((c) => [c.id, c.name] as const));
    const items: UserItem[] = (profiles ?? []).map((p: any) => {
      const rs = rolesBy.get(p.id) ?? ["cliente"];
      return { ...p, roles: rs, primary: primaryOf(rs), company_name: p.company_id ? coMap.get(p.company_id) ?? null : null };
    });
    setUsers(items); setCompanies(cos ?? []); setLoading(false);
  }, []);

  useEffect(() => { if (isSupervisor) load(); }, [isSupervisor, load]);

  const toggleActive = async (u: UserItem) => {
    const res = await supabase.functions.invoke("admin-update-user", {
      body: { action: "update", user_id: u.id, active: !u.active },
    });
    const err = (res.data as any)?.error ?? res.error?.message;
    if (err) return toast.error(err);
    toast.success(u.active ? "Usuario desactivado" : "Usuario activado");
    load();
  };

  const removeUser = async () => {
    if (!delUser) return;
    const res = await supabase.functions.invoke("admin-update-user", {
      body: { action: "delete", user_id: delUser.id },
    });
    const err = (res.data as any)?.error ?? res.error?.message;
    setDelUser(null);
    if (err) return toast.error(err);
    toast.success("Usuario eliminado"); load();
  };

  const removeCompany = async () => {
    if (!delCo) return;
    const { error } = await supabase.from("companies").delete().eq("id", delCo.id);
    setDelCo(null);
    if (error) return toast.error(error.message);
    toast.success("Empresa eliminada"); load();
  };

  const filtered = useMemo(() => users.filter((u) => {
    if (filter !== "all" && u.primary !== filter) return false;
    const q = search.toLowerCase();
    if (q && !(u.email ?? "").toLowerCase().includes(q) && !(u.full_name ?? "").toLowerCase().includes(q) && !(u.username ?? "").toLowerCase().includes(q)) return false;
    return true;
  }), [users, filter, search]);

  const counts = useMemo(() => ({
    total: users.length,
    cliente: users.filter((u) => u.primary === "cliente").length,
    tecnico: users.filter((u) => u.primary === "tecnico").length,
    supervisor: users.filter((u) => u.primary === "supervisor").length,
    companies: companies.length,
  }), [users, companies]);

  if (roleLoading) return <AppLayout title="Usuarios"><Skeleton className="h-32" /></AppLayout>;
  if (!isSupervisor) {
    return (
      <AppLayout title="Usuarios">
        <Card className="p-12 text-center shadow-card max-w-lg mx-auto">
          <AlertTriangle className="h-10 w-10 mx-auto text-status-pendiente mb-3" />
          <h2 className="text-lg font-semibold mb-1">Acceso restringido</h2>
          <p className="text-sm text-muted-foreground">Disponible únicamente para supervisores.</p>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Usuarios y empresas">
      <div className="space-y-6 animate-fade-in max-w-[1400px]">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Panel de administración
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Gestión de usuarios y empresas</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Crea cuentas, asigna empresas y administra roles desde un solo lugar.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCoDlg({ open: true, editing: null })} className="gap-2">
              <Briefcase className="h-4 w-4" /> Crear empresa
            </Button>
            <Button onClick={() => setUserDlg({ open: true, editing: null })} className="gap-2">
              <UserPlus className="h-4 w-4" /> Crear usuario
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Usuarios", value: counts.total, icon: UsersIcon, tone: "text-foreground" },
            { label: "Empresas", value: counts.cliente, icon: Building2, tone: "text-primary" },
            { label: "Técnicos", value: counts.tecnico, icon: Wrench, tone: "text-status-pendiente" },
            { label: "Supervisores", value: counts.supervisor, icon: ShieldCheck, tone: "text-status-finalizado" },
            { label: "Empresas reg.", value: counts.companies, icon: Briefcase, tone: "text-primary" },
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

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="gap-1.5"><UsersIcon className="h-4 w-4" /> Usuarios</TabsTrigger>
            <TabsTrigger value="companies" className="gap-1.5"><Briefcase className="h-4 w-4" /> Empresas</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card className="p-4 shadow-card">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nombre, correo o usuario..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-full md:w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    <SelectItem value="cliente">Empresas</SelectItem>
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
                        <TableHead>Empresa</TableHead>
                        <TableHead className="w-[120px]">Rol</TableHead>
                        <TableHead className="w-[100px]">Estado</TableHead>
                        <TableHead className="w-[180px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No se encontraron usuarios.</TableCell></TableRow>
                      ) : filtered.map((u) => {
                        const Icon = ROLE_ICON[u.primary];
                        const isSelf = u.id === user?.id;
                        return (
                          <TableRow key={u.id} className={!u.active ? "opacity-60" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${ROLE_BADGE[u.primary]}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{u.full_name || u.email || "(sin datos)"}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {u.email}{u.username && ` · @${u.username}`}{isSelf && " · tú"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{u.company_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_BADGE[u.primary]}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${ROLE_DOT[u.primary]}`} />
                                {ROLE_LABEL[u.primary]}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs font-medium ${u.active ? "text-status-finalizado" : "text-muted-foreground"}`}>
                                {u.active ? "Activo" : "Inactivo"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" title={u.active ? "Desactivar" : "Activar"} onClick={() => toggleActive(u)} disabled={isSelf}>
                                  {u.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4 text-status-finalizado" />}
                                </Button>
                                <Button size="icon" variant="ghost" title="Editar" onClick={() => setUserDlg({ open: true, editing: u })}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" title="Eliminar" onClick={() => setDelUser(u)} disabled={isSelf}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="companies" className="space-y-4">
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : (
              <Card className="shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead>Empresa</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Correo</TableHead>
                        <TableHead className="w-[100px]">Estado</TableHead>
                        <TableHead className="w-[140px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay empresas registradas.</TableCell></TableRow>
                      ) : companies.map((c) => (
                        <TableRow key={c.id} className={!c.active ? "opacity-60" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full grid place-items-center shrink-0 bg-primary-soft text-primary border border-primary/20">
                                <Building2 className="h-4 w-4" />
                              </div>
                              <span className="font-medium">{c.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{c.contact ?? "—"}</TableCell>
                          <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium ${c.active ? "text-status-finalizado" : "text-muted-foreground"}`}>
                              {c.active ? "Activa" : "Inactiva"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" title="Editar" onClick={() => setCoDlg({ open: true, editing: c })}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" title="Eliminar" onClick={() => setDelCo(c)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <UserDialog
        open={userDlg.open}
        onOpenChange={(v) => setUserDlg((s) => ({ ...s, open: v }))}
        companies={companies}
        editing={userDlg.editing}
        onSaved={load}
      />
      <CompanyDialog
        open={coDlg.open}
        onOpenChange={(v) => setCoDlg((s) => ({ ...s, open: v }))}
        editing={coDlg.editing}
        onSaved={load}
      />

      <AlertDialog open={!!delUser} onOpenChange={(v) => !v && setDelUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente <strong>{delUser?.email}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removeUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!delCo} onOpenChange={(v) => !v && setDelCo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{delCo?.name}</strong>. Los usuarios asociados quedarán sin empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removeCompany} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default function Usuarios() {
  return <RequireAuth><UsuariosPage /></RequireAuth>;
}

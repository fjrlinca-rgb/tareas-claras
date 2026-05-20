import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Priority, Status, Ticket, PRIORITY_LABEL, STATUS_LABEL, PRIORITIES, STATUSES } from "@/lib/tickets";
import { AppRole } from "@/hooks/useUserRole";
import { ShieldCheck, Wrench, User, History, Pencil, Building2, Calendar, AlertCircle, FileText, Eye } from "lucide-react";
import { Technician } from "@/hooks/useTechnicians";
import { useTechnicianNames } from "@/hooks/useTechnicianNames";
import { TicketHistory } from "./TicketHistory";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export interface TicketFormValues {
  title: string;
  description: string | null;
  priority: Priority;
  status: Status;
  assigned_technician: string | null;
  observations?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (values: TicketFormValues) => Promise<void>;
  ticket?: Ticket | null;
  role: AppRole;
  technicians?: Technician[];
}

const UNASSIGNED = "__unassigned__";

const priorityTone: Record<string, string> = {
  baja: "bg-muted text-muted-foreground",
  media: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  alta: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  critica: "bg-red-500/15 text-red-400 border border-red-500/30",
};

export const TicketDialog = ({ open, onOpenChange, onSave, ticket, role, technicians = [] }: Props) => {
  const isEdit = !!ticket;
  const isSupervisor = role === "supervisor";
  const isTecnico = role === "tecnico";
  const isCliente = role === "cliente";
  const { getName: getTechnicianName } = useTechnicianNames();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [status, setStatus] = useState<Status>("pendiente");
  const [technician, setTechnician] = useState<string>(UNASSIGNED);
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("edit");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(ticket?.title ?? "");
      setDescription(ticket?.description ?? "");
      setPriority((ticket?.priority as Priority) ?? "media");
      setStatus((ticket?.status as Status) ?? "pendiente");
      setTechnician(ticket?.assigned_technician ?? UNASSIGNED);
      setObservations((ticket as any)?.observations ?? "");
      setTab("edit");
      setCompanyName(null);
      setOwnerEmail(null);
    }
  }, [open, ticket]);

  // Técnico: al abrir un ticket asignado no leído, marcar como visto.
  useEffect(() => {
    if (!open || !isTecnico || !ticket?.id) return;
    if ((ticket as any).visto_por_tecnico === false) {
      supabase.from("entradas").update({ visto_por_tecnico: true }).eq("id", ticket.id).then(() => {});
    }
  }, [open, isTecnico, ticket?.id]);

  // Supervisor: al abrir un ticket no revisado, marcar como visto.
  useEffect(() => {
    if (!open || !isSupervisor || !ticket?.id) return;
    if ((ticket as any).visto_por_supervisor === false) {
      supabase.from("entradas").update({ visto_por_supervisor: true }).eq("id", ticket.id).then(() => {});
    }
  }, [open, isSupervisor, ticket?.id]);

  // Cargar empresa / correo del solicitante (solo supervisor en edición)
  useEffect(() => {
    if (!open || !isSupervisor || !ticket?.user_id) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("email, company_id, full_name")
        .eq("id", ticket.user_id)
        .maybeSingle();
      setOwnerEmail(prof?.email ?? null);
      if (prof?.company_id) {
        const { data: comp } = await supabase
          .from("companies")
          .select("name")
          .eq("id", prof.company_id)
          .maybeSingle();
        setCompanyName(comp?.name ?? prof.full_name ?? prof.email ?? null);
      } else {
        setCompanyName(prof?.full_name ?? prof?.email ?? null);
      }
    })();
  }, [open, isSupervisor, ticket?.user_id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let values: TicketFormValues;
    if (isCliente) {
      values = { title: title.trim(), description: description.trim() || null, priority, status: "pendiente", assigned_technician: null };
    } else if (isTecnico) {
      values = {
        title: ticket!.title,
        description: ticket!.description,
        priority: ticket!.priority as Priority,
        status,
        assigned_technician: ticket!.assigned_technician,
        observations: observations.trim() || null,
      };
    } else if (isSupervisor && isEdit) {
      // Supervisor en edición: solo técnico, estado y observaciones
      values = {
        title: ticket!.title,
        description: ticket!.description,
        priority: ticket!.priority as Priority,
        status,
        assigned_technician: technician === UNASSIGNED ? null : technician,
        observations: observations.trim() || null,
      };
    } else {
      values = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        assigned_technician: technician === UNASSIGNED ? null : technician,
        observations: observations.trim() || null,
      };
    }

    if (!values.title) { setSaving(false); return; }
    await onSave(values);
    setSaving(false);
    onOpenChange(false);
  };

  const roleBadge = isSupervisor ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary"><ShieldCheck className="h-3 w-3" /> Supervisor</span>
  ) : isTecnico ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"><Wrench className="h-3 w-3" /> Técnico</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"><User className="h-3 w-3" /> Cliente</span>
  );

  const titleText = isEdit
    ? (isTecnico ? "Actualizar ticket asignado" : isCliente ? "Detalle del ticket" : "Gestionar ticket")
    : "Crear nuevo ticket";

  // ============ VISTA SIMPLIFICADA SUPERVISOR (EDICIÓN) ============
  if (isEdit && isSupervisor) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-base">{ticket!.title}</DialogTitle>
              {roleBadge}
            </div>
          </DialogHeader>

          {/* Resumen del ticket (lectura) */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Empresa</p>
                  <p className="font-medium truncate">{companyName ?? ownerEmail ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Creado</p>
                  <p className="font-medium">
                    {ticket!.created_at ? format(new Date(ticket!.created_at), "d MMM yyyy HH:mm", { locale: es }) : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Prioridad</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-0.5 ${priorityTone[ticket!.priority] ?? ""}`}>
                    {PRIORITY_LABEL[ticket!.priority as Priority] ?? ticket!.priority}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Estado actual</p>
                  <p className="font-medium">{STATUS_LABEL[ticket!.status as Status] ?? ticket!.status}</p>
                </div>
              </div>
            </div>
            {ticket!.description && (
              <div className="pt-2 border-t border-border/60">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Descripción del problema</p>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{ticket!.description}</p>
              </div>
            )}
          </div>

          {/* Formulario compacto */}
          <form onSubmit={submit} className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tech">Técnico asignado</Label>
                <Select value={technician} onValueChange={setTechnician}>
                  <SelectTrigger id="tech"><SelectValue placeholder="Selecciona un técnico" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Sin asignar (temporal)</SelectItem>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.email}>
                        {(t.name || t.email)} · {t.email}
                        {typeof t.ticketCount === "number" ? ` — ${t.ticketCount} abiertos` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {technicians.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No hay usuarios con rol <strong>técnico</strong>. Crea o promueve uno desde <strong>Usuarios</strong>.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs">Observaciones internas</Label>
              <Textarea id="obs" value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} placeholder="Notas internas, diagnóstico, acciones realizadas..." />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
            </DialogFooter>
          </form>

          {/* Historial debajo */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Historial de cambios</h4>
            </div>
            <TicketHistory ticketId={ticket!.id} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ============ VISTA POR DEFECTO (cliente / técnico / creación) ============
  const formBody = (
    <form onSubmit={submit} className="space-y-4">
      {isTecnico || isCliente && isEdit ? (
        <div className="space-y-1">
          <Label className="text-muted-foreground">Título</Label>
          <p className="text-sm font-medium">{title}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumen del problema" required />
        </div>
      )}

      {(isTecnico || (isCliente && isEdit)) ? (
        description ? (
          <div className="space-y-1">
            <Label className="text-muted-foreground">Descripción</Label>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{description}</p>
          </div>
        ) : null
      ) : (
        <div className="space-y-2">
          <Label htmlFor="desc">Descripción del problema</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe detalladamente el problema, mensajes de error, equipos afectados, horarios y cualquier información útil."
            rows={6}
            className="min-h-[140px] resize-y px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/70"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Prioridad</Label>
          {isTecnico || (isCliente && isEdit) ? (
            <p className="text-sm pt-2">{PRIORITY_LABEL[priority]}</p>
          ) : (
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {isCliente ? (
          <div className="space-y-2">
            <Label>Estado {isEdit ? "" : "inicial"}</Label>
            <p className="text-sm pt-2 text-muted-foreground">{isEdit ? STATUS_LABEL[status] : "Pendiente (automático)"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isTecnico && ticket?.assigned_technician && (
        <div className="space-y-1">
          <Label className="text-muted-foreground">Asignado a</Label>
          {(() => {
            const name = getTechnicianName(ticket.assigned_technician);
            return (
              <div>
                <p className="text-sm font-medium">{name ?? ticket.assigned_technician}</p>
                {name && <p className="text-xs text-muted-foreground">{ticket.assigned_technician}</p>}
              </div>
            );
          })()}
        </div>
      )}

      {isTecnico && (
        <div className="space-y-2">
          <Label htmlFor="obs">Observaciones internas</Label>
          <Textarea id="obs" value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} placeholder="Notas internas, diagnóstico, acciones realizadas..." />
        </div>
      )}

      {isCliente && isEdit && (ticket as any)?.observations && (
        <div className="space-y-1">
          <Label className="text-muted-foreground">Observaciones del equipo</Label>
          <p className="text-sm whitespace-pre-wrap">{(ticket as any).observations}</p>
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
        {isTecnico && isEdit && ticket && ticket.status !== "en_revision" && ticket.status !== "finalizado" && (
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            className="border-status-revision/40 text-status-revision hover:bg-status-revision-soft hover:text-status-revision"
            onClick={async () => {
              setSaving(true);
              await onSave({
                title: ticket.title,
                description: ticket.description,
                priority: ticket.priority as Priority,
                status: "en_revision",
                assigned_technician: ticket.assigned_technician,
                observations: (observations.trim() || (ticket as any).observations) || null,
              });
              setSaving(false);
              onOpenChange(false);
            }}
          >
            <Eye className="h-4 w-4 mr-1" /> Marcar en revisión
          </Button>
        )}
        {!(isCliente && isEdit) && (
          <Button type="submit" disabled={saving}>{saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear ticket"}</Button>
        )}
      </DialogFooter>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>{titleText}</DialogTitle>
            {roleBadge}
          </div>
          {isCliente && !isEdit && (
            <DialogDescription>Tu ticket quedará pendiente. El supervisor lo revisará y asignará un técnico.</DialogDescription>
          )}
          {isTecnico && (
            <DialogDescription>Solo puedes actualizar el estado y agregar observaciones.</DialogDescription>
          )}
        </DialogHeader>

        {isEdit && isTecnico ? (
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="edit"><Pencil className="h-3.5 w-3.5 mr-1.5" />Detalles</TabsTrigger>
              <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1.5" />Historial</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-4">{formBody}</TabsContent>
            <TabsContent value="history" className="mt-4">
              <TicketHistory ticketId={ticket!.id} />
            </TabsContent>
          </Tabs>
        ) : formBody}
      </DialogContent>
    </Dialog>
  );
};

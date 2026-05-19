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
import { ShieldCheck, Wrench, User, History, Pencil } from "lucide-react";
import { Technician } from "@/hooks/useTechnicians";
import { TicketHistory } from "./TicketHistory";

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

export const TicketDialog = ({ open, onOpenChange, onSave, ticket, role, technicians = [] }: Props) => {
  const isEdit = !!ticket;
  const isSupervisor = role === "supervisor";
  const isTecnico = role === "tecnico";
  const isCliente = role === "cliente";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [status, setStatus] = useState<Status>("pendiente");
  const [technician, setTechnician] = useState<string>(UNASSIGNED);
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("edit");

  useEffect(() => {
    if (open) {
      setTitle(ticket?.title ?? "");
      setDescription(ticket?.description ?? "");
      setPriority((ticket?.priority as Priority) ?? "media");
      setStatus((ticket?.status as Status) ?? "pendiente");
      setTechnician(ticket?.assigned_technician ?? UNASSIGNED);
      setObservations((ticket as any)?.observations ?? "");
      setTab("edit");
    }
  }, [open, ticket]);

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
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe el problema con el mayor detalle posible..." rows={4} />
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

      {isSupervisor && (
        <div className="space-y-2">
          <Label htmlFor="tech">Técnico asignado</Label>
          <Select value={technician} onValueChange={setTechnician}>
            <SelectTrigger id="tech"><SelectValue placeholder="Selecciona un técnico" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Sin asignar (temporal)</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.email}>
                  {t.name ? `${t.name} · ${t.email}` : t.email}
                  {t.specialty ? ` — ${t.specialty}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {technicians.length === 0 && (
            <p className="text-xs text-muted-foreground">No hay técnicos activos. Agrega uno desde el módulo Técnicos.</p>
          )}
        </div>
      )}

      {isTecnico && ticket?.assigned_technician && (
        <div className="space-y-1">
          <Label className="text-muted-foreground">Asignado a</Label>
          <p className="text-sm">{ticket.assigned_technician}</p>
        </div>
      )}

      {(isSupervisor || isTecnico) && (
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

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
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

        {isEdit ? (
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

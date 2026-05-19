import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Priority, Status, Ticket, PRIORITY_LABEL, STATUS_LABEL, PRIORITIES, STATUSES } from "@/lib/tickets";
import { AppRole } from "@/hooks/useUserRole";
import { ShieldCheck, Wrench, User } from "lucide-react";

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
  technicianOptions?: string[];
}

export const TicketDialog = ({ open, onOpenChange, onSave, ticket, role, technicianOptions = [] }: Props) => {
  const isEdit = !!ticket;
  const isSupervisor = role === "supervisor";
  const isTecnico = role === "tecnico";
  const isCliente = role === "cliente";

  // Cliente: solo título/descripción/prioridad al crear. No edita.
  // Técnico: solo cambia estado + observaciones de sus tickets asignados.
  // Supervisor: control total.

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [status, setStatus] = useState<Status>("pendiente");
  const [technician, setTechnician] = useState("");
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(ticket?.title ?? "");
      setDescription(ticket?.description ?? "");
      setPriority((ticket?.priority as Priority) ?? "media");
      setStatus((ticket?.status as Status) ?? "pendiente");
      setTechnician(ticket?.assigned_technician ?? "");
      setObservations((ticket as any)?.observations ?? "");
    }
  }, [open, ticket]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let values: TicketFormValues;
    if (isCliente) {
      // Cliente crea: estado siempre pendiente, sin técnico
      values = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status: "pendiente",
        assigned_technician: null,
      };
    } else if (isTecnico) {
      // Técnico solo actualiza estado + observaciones
      values = {
        title: ticket!.title,
        description: ticket!.description,
        priority: ticket!.priority as Priority,
        status,
        assigned_technician: ticket!.assigned_technician,
        observations: observations.trim() || null,
      };
    } else {
      // Supervisor
      values = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        assigned_technician: technician.trim() || null,
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
    ? (isTecnico ? "Actualizar ticket asignado" : "Editar ticket")
    : "Crear nuevo ticket";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
        <form onSubmit={submit} className="space-y-4">
          {/* Título */}
          {isTecnico ? (
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

          {/* Descripción */}
          {isTecnico ? (
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

          {/* Prioridad / Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              {isTecnico || isCliente && false ? (
                <p className="text-sm pt-2">{PRIORITY_LABEL[priority]}</p>
              ) : isTecnico ? (
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

            {/* Estado: solo supervisor y técnico */}
            {isCliente ? (
              <div className="space-y-2">
                <Label>Estado inicial</Label>
                <p className="text-sm pt-2 text-muted-foreground">Pendiente (automático)</p>
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

          {/* Técnico: SOLO supervisor */}
          {isSupervisor && (
            <div className="space-y-2">
              <Label htmlFor="tech">Técnico asignado (email)</Label>
              <Input
                id="tech"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                placeholder="tecnico@empresa.com"
                list="tech-options"
                type="email"
              />
              {technicianOptions.length > 0 && (
                <datalist id="tech-options">
                  {technicianOptions.map((t) => <option key={t} value={t} />)}
                </datalist>
              )}
              <p className="text-xs text-muted-foreground">El técnico solo podrá ver y actualizar tickets asignados a su email.</p>
            </div>
          )}

          {/* Técnico asignado (lectura) para técnico */}
          {isTecnico && ticket?.assigned_technician && (
            <div className="space-y-1">
              <Label className="text-muted-foreground">Asignado a</Label>
              <p className="text-sm">{ticket.assigned_technician}</p>
            </div>
          )}

          {/* Observaciones: supervisor y técnico */}
          {(isSupervisor || isTecnico) && (
            <div className="space-y-2">
              <Label htmlFor="obs">Observaciones internas</Label>
              <Textarea id="obs" value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} placeholder="Notas internas, diagnóstico, acciones realizadas..." />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear ticket"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

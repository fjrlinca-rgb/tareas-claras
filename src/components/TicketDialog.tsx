import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Priority, Status, Ticket, PRIORITY_LABEL, STATUS_LABEL, PRIORITIES, STATUSES } from "@/lib/tickets";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (values: {
    title: string;
    description: string | null;
    priority: Priority;
    status: Status;
    assigned_technician: string | null;
  }) => Promise<void>;
  ticket?: Ticket | null;
}

export const TicketDialog = ({ open, onOpenChange, onSave, ticket }: Props) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [status, setStatus] = useState<Status>("pendiente");
  const [technician, setTechnician] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(ticket?.title ?? "");
      setDescription(ticket?.description ?? "");
      setPriority((ticket?.priority as Priority) ?? "media");
      setStatus((ticket?.status as Status) ?? "pendiente");
      setTechnician(ticket?.assigned_technician ?? "");
    }
  }, [open, ticket]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      assigned_technician: technician.trim() || null,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ticket ? "Editar ticket" : "Crear nuevo ticket"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumen del problema" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Descripción del problema</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe el problema con el mayor detalle posible..." rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tech">Técnico asignado</Label>
            <Input id="tech" value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="Nombre del técnico" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : ticket ? "Guardar cambios" : "Crear ticket"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

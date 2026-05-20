import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Pencil, Trash2, User2, CheckCircle2, Eye, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Ticket } from "@/lib/tickets";
import { PriorityBadge, StatusBadge } from "./TicketBadges";
import { AppRole } from "@/hooks/useUserRole";

interface Props {
  tickets: Ticket[];
  onEdit: (t: Ticket) => void;
  onDelete?: (t: Ticket) => void;
  onFinalize?: (t: Ticket) => void;
  onAssign?: (t: Ticket) => void;
  role?: AppRole;
  getTechnicianName?: (email: string | null | undefined) => string | null;
}

export const TicketsTable = ({ tickets, onEdit, onDelete, onFinalize, onAssign, role = "cliente", getTechnicianName }: Props) => {
  const isSupervisor = role === "supervisor";
  const isTecnico = role === "tecnico";

  if (tickets.length === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground shadow-card">
        No hay tickets para mostrar.
      </Card>
    );
  }
  return (
    <Card className="shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[90px]">ID</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="w-[120px]">Prioridad</TableHead>
              <TableHead className="w-[140px]">Estado</TableHead>
              <TableHead className="w-[200px]">Técnico</TableHead>
              <TableHead className="w-[140px]">Creado</TableHead>
              <TableHead className="w-[120px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((t) => (
              <TableRow key={t.id} className="group">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  #{t.id.slice(0, 8)}
                </TableCell>
                <TableCell className="max-w-md">
                  <div className="font-medium truncate">{t.title}</div>
                  {t.description && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{t.description}</div>
                  )}
                </TableCell>
                <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell>
                  {t.assigned_technician ? (
                    (() => {
                      const name = getTechnicianName?.(t.assigned_technician);
                      return (
                        <div className="flex items-start gap-1.5 text-sm min-w-0">
                          <User2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[170px]">{name ?? t.assigned_technician}</div>
                            {name && (
                              <div className="text-[11px] text-muted-foreground truncate max-w-[170px]">
                                {t.assigned_technician}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : isSupervisor && onAssign ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAssign(t)}>
                      <UserPlus className="h-3 w-3 mr-1" /> Asignar técnico
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(t.created_at), "d MMM yyyy", { locale: es })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    {(isSupervisor || isTecnico) && t.status !== "finalizado" && onFinalize && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-status-finalizado hover:text-status-finalizado" onClick={() => onFinalize(t)} aria-label="Finalizar">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(t)} aria-label={isSupervisor || isTecnico ? "Editar" : "Ver"}>
                      {isSupervisor || isTecnico ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    {isSupervisor && onDelete && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(t)} aria-label="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

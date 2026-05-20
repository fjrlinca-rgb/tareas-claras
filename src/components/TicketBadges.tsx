import { cn } from "@/lib/utils";
import { Priority, Status, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/tickets";
import { AlertTriangle, Flame, Activity, ArrowDown } from "lucide-react";

const priorityClasses: Record<Priority, string> = {
  baja: "bg-priority-baja-soft text-priority-baja border-priority-baja/30",
  media: "bg-priority-media-soft text-priority-media border-priority-media/30",
  alta: "bg-priority-alta-soft text-priority-alta border-priority-alta/30",
  critica: "bg-priority-critica-soft text-priority-critica border-priority-critica/40",
};

const priorityIcons: Record<Priority, React.ComponentType<{ className?: string }>> = {
  baja: ArrowDown,
  media: Activity,
  alta: AlertTriangle,
  critica: Flame,
};

const statusClasses: Record<Status, string> = {
  pendiente: "bg-status-pendiente-soft text-status-pendiente border-status-pendiente/30",
  en_proceso: "bg-status-proceso-soft text-status-proceso border-status-proceso/30",
  en_revision: "bg-status-revision-soft text-status-revision border-status-revision/30",
  finalizado: "bg-status-finalizado-soft text-status-finalizado border-status-finalizado/30",
};

export const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const Icon = priorityIcons[priority];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
      priorityClasses[priority]
    )}>
      <Icon className="h-3 w-3" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
};

export const StatusBadge = ({ status }: { status: Status }) => {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
      statusClasses[status]
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-status-pendiente": status === "pendiente",
        "bg-status-proceso": status === "en_proceso",
        "bg-status-revision": status === "en_revision",
        "bg-status-finalizado": status === "finalizado",
      })} />
      {STATUS_LABEL[status]}
    </span>
  );
};

import { format, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, Pencil, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Task, isOverdue } from "@/lib/tasks";

interface Props {
  task: Task;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}

const priorityClasses: Record<string, string> = {
  alta: "bg-priority-alta-soft text-priority-alta border-priority-alta/20",
  media: "bg-priority-media-soft text-priority-media border-priority-media/20",
  baja: "bg-priority-baja-soft text-priority-baja border-priority-baja/20",
};

export const TaskItem = ({ task, onToggle, onEdit, onDelete }: Props) => {
  const overdue = isOverdue(task);
  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-4 rounded-xl border bg-card shadow-card transition-all hover:shadow-soft",
        task.completed && "opacity-60"
      )}
    >
      <Checkbox checked={task.completed} onCheckedChange={() => onToggle(task)} className="mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn("font-medium leading-snug", task.completed && "line-through text-muted-foreground")}>
            {task.title}
          </h3>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(task)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(task)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="outline" className={cn("border", priorityClasses[task.priority])}>
            {task.priority}
          </Badge>
          <Badge variant="secondary" className="font-normal">{task.category}</Badge>
          {task.due_date && (
            <span className={cn(
              "inline-flex items-center gap-1 text-xs",
              overdue ? "text-destructive font-medium" : "text-muted-foreground"
            )}>
              {overdue ? <AlertCircle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
              {format(new Date(task.due_date), "d MMM yyyy", { locale: es })}
              {overdue && " · vencida"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

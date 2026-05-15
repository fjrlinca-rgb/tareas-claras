import { CheckCircle2, ListTodo, Flame, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Task, isToday, isThisWeek, isOverdue } from "@/lib/tasks";

export const Stats = ({ tasks }: { tasks: Task[] }) => {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const todayDone = tasks.filter((t) => t.completed && isToday(t.completed_at)).length;
  const weekDone = tasks.filter((t) => t.completed && isThisWeek(t.completed_at)).length;
  const overdue = tasks.filter(isOverdue).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const items = [
    { label: "Hoy completadas", value: todayDone, icon: Flame, color: "text-warning" },
    { label: "Esta semana", value: weekDone, icon: TrendingUp, color: "text-primary" },
    { label: "Pendientes", value: total - completed, icon: ListTodo, color: "text-accent-foreground" },
    { label: "Vencidas", value: overdue, icon: CheckCircle2, color: "text-destructive" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((it) => (
          <Card key={it.label} className="p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{it.label}</span>
              <it.icon className={`h-4 w-4 ${it.color}`} />
            </div>
            <p className="text-2xl font-semibold mt-2">{it.value}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4 shadow-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Productividad general</span>
          <span className="text-sm text-muted-foreground">{completed} / {total} · {pct}%</span>
        </div>
        <Progress value={pct} />
      </Card>
    </div>
  );
};

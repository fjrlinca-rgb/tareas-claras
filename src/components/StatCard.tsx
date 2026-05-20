import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "warning" | "primary" | "success" | "destructive" | "review";
}

const tones = {
  warning: { ring: "bg-status-pendiente-soft text-status-pendiente", bar: "bg-status-pendiente" },
  primary: { ring: "bg-status-proceso-soft text-status-proceso", bar: "bg-status-proceso" },
  review: { ring: "bg-status-revision-soft text-status-revision", bar: "bg-status-revision" },
  success: { ring: "bg-status-finalizado-soft text-status-finalizado", bar: "bg-status-finalizado" },
  destructive: { ring: "bg-priority-critica-soft text-priority-critica", bar: "bg-priority-critica" },
};

export const StatCard = ({ label, value, icon: Icon, tone }: Props) => {
  const t = tones[tone];
  return (
    <Card className="p-5 shadow-card relative overflow-hidden">
      <div className={cn("absolute inset-x-0 top-0 h-0.5", t.bar)} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-3xl font-semibold mt-2 tabular-nums">{value}</p>
        </div>
        <div className={cn("h-10 w-10 rounded-lg grid place-items-center", t.ring)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
};

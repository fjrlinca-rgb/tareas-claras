import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Ticket, formatDuracion, segundosDesde, tonoCronometro } from "@/lib/tickets";

interface Props {
  ticket: Pick<Ticket, "status" | "fecha_inicio_revision" | "fecha_finalizacion" | "tiempo_resolucion_segundos" | "tiempo_resolucion_texto">;
  /** Cuando es true: estilo compacto (para tabla). Cuando false: pill grande con icono. */
  compact?: boolean;
  /** Sufijo opcional cuando está en vivo, p.ej. "en revisión". */
  liveSuffix?: string;
  className?: string;
}

const toneClass: Record<string, string> = {
  ok: "text-status-finalizado",
  warn: "text-status-pendiente",
  danger: "text-priority-critica",
  muted: "text-muted-foreground",
};
const toneBg: Record<string, string> = {
  ok: "bg-status-finalizado-soft text-status-finalizado",
  warn: "bg-status-pendiente-soft text-status-pendiente",
  danger: "bg-priority-critica-soft text-priority-critica",
  muted: "bg-muted text-muted-foreground",
};

export const Cronometro = ({ ticket, compact = false, liveSuffix, className }: Props) => {
  const finalizado = ticket.status === "finalizado";
  const enCurso = !finalizado && !!ticket.fecha_inicio_revision;

  // Tick cada 30s sólo cuando está en curso
  const [, setNow] = useState(0);
  useEffect(() => {
    if (!enCurso) return;
    const id = setInterval(() => setNow((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [enCurso]);

  let segundos: number | null = null;
  let texto = "—";

  if (finalizado) {
    segundos = ticket.tiempo_resolucion_segundos ?? segundosDesde(ticket.fecha_inicio_revision, ticket.fecha_finalizacion);
    texto = ticket.tiempo_resolucion_texto || (segundos != null ? formatDuracion(segundos) : "—");
  } else if (enCurso) {
    segundos = segundosDesde(ticket.fecha_inicio_revision);
    texto = segundos != null ? formatDuracion(segundos) : "—";
  } else {
    return <span className={cn("text-xs text-muted-foreground italic", className)}>Sin iniciar</span>;
  }

  const tono = tonoCronometro(segundos);

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 tabular-nums font-medium", toneClass[tono], className)}>
        <Clock className="h-3 w-3" />
        {texto}
        {enCurso && liveSuffix && <span className="text-[10px] text-muted-foreground font-normal">· {liveSuffix}</span>}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium tabular-nums", toneBg[tono], className)}>
      <Clock className="h-3.5 w-3.5" />
      {texto}
      {enCurso && liveSuffix && <span className="opacity-70 font-normal">· {liveSuffix}</span>}
    </span>
  );
};

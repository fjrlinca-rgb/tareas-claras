export type Priority = "baja" | "media" | "alta" | "critica";
export type Status = "pendiente" | "en_proceso" | "en_revision" | "finalizado" | "cancelado";

export interface Ticket {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: Status;
  assigned_technician: string | null;
  observations?: string | null;
  visto_por_tecnico?: boolean;
  visto_por_supervisor?: boolean;
  created_at: string;
  updated_at: string;
  fecha_inicio_revision?: string | null;
  fecha_finalizacion?: string | null;
  tiempo_resolucion_segundos?: number | null;
  tiempo_resolucion_texto?: string | null;
  // Específicos órdenes de trabajo
  tipo?: string | null;
  company_id?: string | null;
  evidencias?: string[] | null;
}

/** Formatea una duración en segundos a "15 min" / "2 h 14 min" / "1 d 3 h". */
export function formatDuracion(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${Math.max(1, m)} min`;
}

/** Devuelve segundos transcurridos desde `inicio` hasta `fin` (o ahora). */
export function segundosDesde(inicio?: string | null, fin?: string | null): number | null {
  if (!inicio) return null;
  const start = new Date(inicio).getTime();
  const end = fin ? new Date(fin).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
}

/** Tono semáforo: verde <1h, amarillo 1-4h, rojo >4h. */
export function tonoCronometro(segundos: number | null | undefined): "ok" | "warn" | "danger" | "muted" {
  if (segundos == null) return "muted";
  if (segundos < 3600) return "ok";
  if (segundos < 4 * 3600) return "warn";
  return "danger";
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

export const STATUS_LABEL: Record<Status, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  en_revision: "En revisión",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export const PRIORITIES: Priority[] = ["baja", "media", "alta", "critica"];
/** Estados para tickets (sin "cancelado"). */
export const STATUSES: Status[] = ["pendiente", "en_proceso", "en_revision", "finalizado"];
/** Estados para órdenes de trabajo (incluye "cancelado"). */
export const STATUSES_OT: Status[] = ["pendiente", "en_proceso", "en_revision", "finalizado", "cancelado"];

// Tipos para órdenes de trabajo
export const ORDEN_TIPOS = ["mantenimiento", "instalacion", "visita", "configuracion", "otro"] as const;
export type OrdenTipo = typeof ORDEN_TIPOS[number];
export const ORDEN_TIPO_LABEL: Record<OrdenTipo, string> = {
  mantenimiento: "Mantenimiento",
  instalacion: "Instalación",
  visita: "Visita técnica",
  configuracion: "Configuración",
  otro: "Otro",
};

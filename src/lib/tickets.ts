export type Priority = "baja" | "media" | "alta" | "critica";
export type Status = "pendiente" | "en_proceso" | "en_revision" | "finalizado";

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
};

export const PRIORITIES: Priority[] = ["baja", "media", "alta", "critica"];
export const STATUSES: Status[] = ["pendiente", "en_proceso", "en_revision", "finalizado"];

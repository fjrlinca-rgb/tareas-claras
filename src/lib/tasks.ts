export type Priority = "alta" | "media" | "baja";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: Priority;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const DEFAULT_CATEGORIES = ["Trabajo", "Personal", "Estudio", "Salud", "Hogar", "General"];

export const isOverdue = (t: Task) =>
  !!t.due_date && !t.completed && new Date(t.due_date).getTime() < Date.now();

export const isToday = (iso: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export const isThisWeek = (iso: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  const start = new Date(n);
  const day = (n.getDay() + 6) % 7; // Monday = 0
  start.setDate(n.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
};

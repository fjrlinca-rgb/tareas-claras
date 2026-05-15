import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut, CheckCircle2, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskDialog } from "@/components/TaskDialog";
import { TaskItem } from "@/components/TaskItem";
import { Stats } from "@/components/Stats";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Task, isToday, isThisWeek, Priority } from "@/lib/tasks";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("completed", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setTasks((data ?? []) as Task[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (t: Task) => { setEditing(t); setDialogOpen(true); };

  const handleSave = async (values: { title: string; description: string | null; category: string; priority: Priority; due_date: string | null }) => {
    if (editing) {
      const { error } = await supabase.from("tasks").update(values).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Tarea actualizada");
    } else {
      const { error } = await supabase.from("tasks").insert({ ...values, user_id: user!.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Tarea creada");
    }
    await load();
  };

  const handleToggle = async (t: Task) => {
    const completed = !t.completed;
    const { error } = await supabase
      .from("tasks")
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, completed, completed_at: completed ? new Date().toISOString() : null } : x));
  };

  const handleDelete = async (t: Task) => {
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    toast.success("Tarea eliminada");
  };

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  const todayTasks = useMemo(() => tasks.filter((t) => isToday(t.due_date) || (!t.due_date && !t.completed)), [tasks]);
  const weekTasks = useMemo(() => tasks.filter((t) => isThisWeek(t.due_date)), [tasks]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/60 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <span className="font-semibold">Tareas Diarias</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <section className="container py-8 space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Hola 👋</h1>
            <p className="text-muted-foreground mt-1">Esto es lo que tienes para hoy.</p>
          </div>
          <Button onClick={openNew} size="lg" className="shadow-soft">
            <Plus className="h-4 w-4 mr-1" /> Nueva tarea
          </Button>
        </div>

        <Stats tasks={tasks} />

        <Tabs defaultValue="today" className="w-full">
          <TabsList>
            <TabsTrigger value="today">Hoy</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4">
            <TaskList tasks={todayTasks} loading={loading} onToggle={handleToggle} onEdit={openEdit} onDelete={handleDelete} emptyMsg="Nada para hoy. ¡Disfruta tu día!" />
          </TabsContent>
          <TabsContent value="week" className="mt-4">
            <TaskList tasks={weekTasks} loading={loading} onToggle={handleToggle} onEdit={openEdit} onDelete={handleDelete} emptyMsg="No hay tareas esta semana." />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <TaskList tasks={tasks} loading={loading} onToggle={handleToggle} onEdit={openEdit} onDelete={handleDelete} emptyMsg="Aún no tienes tareas. Crea la primera." />
          </TabsContent>
        </Tabs>
      </section>

      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSave} task={editing} />
    </main>
  );
};

const TaskList = ({
  tasks, loading, onToggle, onEdit, onDelete, emptyMsg,
}: {
  tasks: Task[]; loading: boolean; emptyMsg: string;
  onToggle: (t: Task) => void; onEdit: (t: Task) => void; onDelete: (t: Task) => void;
}) => {
  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  if (tasks.length === 0) return (
    <Card className="p-12 text-center shadow-card">
      <ListChecks className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground">{emptyMsg}</p>
    </Card>
  );
  return (
    <div className="space-y-2">
      {tasks.map((t) => <TaskItem key={t.id} task={t} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)}
    </div>
  );
};

export default Dashboard;

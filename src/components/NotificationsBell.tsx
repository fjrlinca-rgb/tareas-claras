import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Ticket as TicketIcon, ClipboardList, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Notif = {
  id: string;
  user_id: string;
  kind: "ticket" | "orden";
  parent_id: string;
  title: string;
  technician_email: string | null;
  finalized_at: string;
  message: string;
  read: boolean;
  created_at: string;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-EC", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return;
    setItems((data ?? []) as Notif[]);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markRead = async (n: Notif) => {
    if (n.read) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", n.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
    );
  };

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums grid place-items-center"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <div className="font-semibold text-sm">Notificaciones</div>
            <div className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} sin leer` : "Todas leídas"}
            </div>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="h-8 gap-1 text-xs"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[460px]">
          {items.length === 0 ? (
            <div className="py-12 px-6 text-center text-sm text-muted-foreground">
              No tienes notificaciones todavía.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const Icon = n.kind === "ticket" ? TicketIcon : ClipboardList;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => markRead(n)}
                      className={cn(
                        "w-full text-left px-4 py-3 flex gap-3 hover:bg-accent transition-colors",
                        !n.read && "bg-primary/5"
                      )}
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full grid place-items-center shrink-0 mt-0.5",
                          n.kind === "ticket"
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                            {n.kind === "ticket" ? "Ticket" : "Orden de trabajo"}
                          </span>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                          )}
                        </div>
                        <div className="text-sm font-medium truncate">
                          {n.title}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.message}
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
                          <span className="truncate">
                            {n.technician_email ?? "—"}
                          </span>
                          <span className="shrink-0 ml-2">
                            {formatDate(n.finalized_at)}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

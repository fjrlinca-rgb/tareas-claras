import { LayoutDashboard, Ticket, Headset, Users, BarChart3, ShieldCheck, LogOut } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { useUnseenTickets } from "@/hooks/useUnseenTickets";
import { useUnseenSupervisor } from "@/hooks/useUnseenSupervisor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Item = { title: string; url: string; icon: any; roles: AppRole[] };

const ALL_ITEMS: Item[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["cliente", "tecnico", "supervisor"] },
  { title: "Tickets", url: "/tickets", icon: Ticket, roles: ["cliente", "tecnico", "supervisor"] },
  { title: "Técnicos", url: "/tecnicos", icon: Users, roles: ["supervisor"] },
  { title: "Reportes", url: "/reportes", icon: BarChart3, roles: ["supervisor"] },
  { title: "Usuarios", url: "/usuarios", icon: ShieldCheck, roles: ["supervisor"] },
];

const ROLE_LABEL: Record<AppRole, string> = { cliente: "Cliente", tecnico: "Técnico", supervisor: "Supervisor" };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { primary } = useUserRole();
  const navigate = useNavigate();
  const unseenTec = useUnseenTickets();
  const unseenSup = useUnseenSupervisor();
  const unseen = primary === "supervisor" ? unseenSup : primary === "tecnico" ? unseenTec : 0;

  const items = ALL_ITEMS.filter((i) => i.roles.includes(primary));
  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));
  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center shrink-0">
            <Headset className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-semibold text-sidebar-foreground leading-tight truncate">HelpDesk</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">NetExpert</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[11px] uppercase tracking-wider">
            Navegación
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink to={item.url} className={cn(
                        "flex items-center gap-3 rounded-md transition-colors",
                        active
                          ? "bg-sidebar-primary/15 text-sidebar-primary-foreground border-l-2 border-sidebar-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-sm font-medium flex-1">{item.title}</span>}
                        {item.url === "/tickets" && unseen > 0 && (
                          <Badge
                            variant="destructive"
                            className={cn(
                              "h-5 min-w-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums",
                              collapsed && "absolute top-1 right-1 h-4 min-w-4 px-1"
                            )}
                          >
                            {unseen > 99 ? "99+" : unseen}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="min-w-0">
              <div className="text-xs text-sidebar-foreground/70 truncate">{user?.email}</div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 mt-0.5">{ROLE_LABEL[primary]}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" onClick={handleSignOut}
            className="text-sidebar-foreground hover:bg-sidebar-accent" aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

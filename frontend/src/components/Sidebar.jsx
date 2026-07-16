import { NavLink } from "react-router-dom";
import {
  Inbox,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Tag,
  LayoutDashboard,
  Users,
  ShieldCheck,
  Bell,
  Settings as SettingsIcon,
  UserCircle,
  Zap,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const staffNav = [
  { to: "/app/all", label: "All Tasks", icon: Inbox, testId: "nav-all" },
  { to: "/app/today", label: "Today", icon: Calendar, testId: "nav-today" },
  { to: "/app/upcoming", label: "Upcoming", icon: CalendarClock, testId: "nav-upcoming" },
  { to: "/app/completed", label: "Completed", icon: CheckCircle2, testId: "nav-completed" },
  { to: "/app/labels", label: "Labels", icon: Tag, testId: "nav-labels" },
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
];

const adminNav = [
  { to: "/app/staff", label: "Staff Management", icon: Users, testId: "nav-staff" },
  { to: "/app/user-tasks", label: "User-wise Tasks", icon: Users, testId: "nav-user-tasks" },
  { to: "/app/audit", label: "Audit Logs", icon: ShieldCheck, testId: "nav-audit" },
  { to: "/app/notifications", label: "Notifications", icon: Bell, testId: "nav-notifications" },
];

const bottomNav = [
  { to: "/app/settings", label: "Settings", icon: SettingsIcon, testId: "nav-settings" },
  { to: "/app/profile", label: "Profile", icon: UserCircle, testId: "nav-profile" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const isAdmin = user?.role === "admin";

  return (
    <aside className="w-[260px] shrink-0 border-r border-border/60 flex flex-col bg-card/40" data-testid="sidebar">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-border/60">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 grid place-items-center">
          <Zap className="w-4 h-4 text-primary" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-display text-[15px] font-bold tracking-tight leading-none">TaskFlow</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">Enterprise</div>
        </div>
      </div>

      <div className="px-3 py-4 flex-1 overflow-y-auto">
        <div className="overline px-3 mb-2">Workspace</div>
        <nav className="flex flex-col gap-1">
          {staffNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.testId}
              className={({ isActive }) => cn("nav-item", isActive && "active")}
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>

        {isAdmin && (
          <>
            <div className="overline px-3 mt-6 mb-2">Admin</div>
            <nav className="flex flex-col gap-1">
              {adminNav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  data-testid={n.testId}
                  className={({ isActive }) => cn("nav-item", isActive && "active")}
                >
                  <n.icon className="w-4 h-4" />
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </>
        )}

        <div className="overline px-3 mt-6 mb-2">Account</div>
        <nav className="flex flex-col gap-1">
          {bottomNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.testId}
              className={({ isActive }) => cn("nav-item", isActive && "active")}
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-border/60 p-3 space-y-2">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-primary/15 grid place-items-center text-primary font-semibold">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate" data-testid="user-name">{user?.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{user?.role}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggle}
            data-testid="theme-toggle"
            className="flex-1 nav-item justify-center py-2"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="text-xs">{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
          <button
            onClick={logout}
            data-testid="logout-btn"
            className="flex-1 nav-item justify-center py-2 hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

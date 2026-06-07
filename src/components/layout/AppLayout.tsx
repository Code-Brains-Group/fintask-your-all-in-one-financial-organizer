import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Wallet, ListChecks, Settings, PieChart, Target,
  Repeat, FileBarChart, KanbanSquare, ListTodo, LogOut, Receipt, ChevronDown, BarChart3, GraduationCap, HelpCircle, Users, Shield, Crown, MoreHorizontal
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { useEffect, useState } from "react";
import HelpTour from "@/components/HelpTour";

const finance = [
  { to: "/finance/transactions", label: "Transactions", icon: Receipt },
  { to: "/finance/budgets", label: "Budgets & Plans", icon: PieChart },
  { to: "/finance/savings", label: "Savings", icon: Target },
  { to: "/finance/recurring", label: "Recurring", icon: Repeat },
  { to: "/finance/reports", label: "Reports", icon: FileBarChart },
];
const tasks = [
  { to: "/tasks", label: "Task List", icon: ListTodo },
  { to: "/tasks/board", label: "Kanban Board", icon: KanbanSquare },
  { to: "/tasks/dashboard", label: "Task Dashboard", icon: BarChart3 },
];

function SideLink({ to, label, icon: Icon }: any) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive ? "bg-primary-soft text-primary font-medium" : "text-foreground/70 hover:bg-muted hover:text-foreground"
        }`
      }
    >
      <Icon className="h-4 w-4" /> {label}
    </NavLink>
  );
}

function Group({ title, icon: Icon, items, defaultOpen }: any) {
  const { pathname } = useLocation();
  const isActive = items.some((i: any) => pathname.startsWith(i.to));
  const [open, setOpen] = useState(defaultOpen ?? isActive);
  useEffect(() => { if (isActive) setOpen(true); }, [isActive]);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-muted">
        <span className="flex items-center gap-3"><Icon className="h-4 w-4" /> {title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-1 ml-4 space-y-1 border-l pl-3">
        {items.map((i: any) => <SideLink key={i.to} {...i} />)}
      </div>}
    </div>
  );
}

export default function AppLayout() {
  const { user, signOut, focus, hasModule, isAdmin, premium } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = async () => { await signOut(); navigate("/auth"); };
  const showFinance = hasModule("finance") && focus !== "tasks";
  const showTasks = hasModule("tasks") && focus !== "finance";
  const showApplications = hasModule("applications");

  return (
    <div className="min-h-screen w-full flex bg-background">
      <HelpTour />
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-sidebar p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 py-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center text-primary-foreground font-bold">F</div>
          <span className="text-lg font-semibold">FinTask</span>
        </div>
        <nav className="space-y-1 flex-1 overflow-y-auto">
          <SideLink to="/" label="Dashboard" icon={LayoutDashboard} />
          {showFinance && <Group title="Finance" icon={Wallet} items={finance} defaultOpen />}
          {showTasks && <Group title="Tasks" icon={ListChecks} items={tasks} defaultOpen={!showFinance} />}
          {showApplications && <SideLink to="/applications" label="Applications" icon={GraduationCap} />}
          <SideLink to="/groups" label="Groups" icon={Users} />
          <SideLink to="/help" label="Help & Tour" icon={HelpCircle} />
          <SideLink to="/settings" label="Settings" icon={Settings} />
          {isAdmin && <SideLink to="/admin" label="Admin Console" icon={Shield} />}
        </nav>
        <div className="border-t pt-3 mt-3 space-y-2">
          <div className="px-3 text-xs text-muted-foreground truncate flex items-center gap-1">
            {premium && <Crown className="h-3 w-3 text-warning" />}
            {user?.email}
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div className="container max-w-7xl px-4 lg:px-8 py-6 animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t flex justify-around py-2 shadow-lg">
        {[
          { to: "/", icon: LayoutDashboard, label: "Home", show: true },
          { to: "/finance/transactions", icon: Receipt, label: "Money", show: showFinance },
          { to: "/tasks", icon: ListTodo, label: "Tasks", show: showTasks },
          { to: "/settings", icon: Settings, label: "Settings", show: true },
        ].filter(i => i.show).map((i) => (
          <NavLink key={i.to} to={i.to} end className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs ${isActive ? "text-primary" : "text-muted-foreground"}`
          }>
            <i.icon className="h-5 w-5" /> {i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

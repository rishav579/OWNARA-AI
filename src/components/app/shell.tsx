"use client";

import { useState } from "react";
import { useRouter, useAuth } from "@/lib/app/router";
import { cn } from "@/lib/utils";
import { api } from "@/lib/app/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Bot,
  ListTodo,
  ShieldCheck,
  BookOpen,
  ScrollText,
  Settings,
  CreditCard,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Plus,
  Zap,
  Scale,
  Plug,
  Building2,
  IndianRupee,
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { path: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { path: "employees", label: "Employees", icon: Bot },
      { path: "approvals", label: "Decision Center", icon: ShieldCheck, badge: 2 },
      { path: "tasks", label: "Tasks", icon: ListTodo },
    ],
  },
  {
    label: "Finance",
    items: [
      { path: "finance", label: "Receivables", icon: IndianRupee },
    ],
  },
  {
    label: "Trust & Audit",
    items: [
      { path: "audit", label: "Audit Timeline", icon: ScrollText },
      { path: "governance", label: "Governance", icon: Scale },
      { path: "knowledge", label: "Knowledge Base", icon: BookOpen },
    ],
  },
  {
    label: "Settings",
    items: [
      { path: "settings", label: "Settings", icon: Settings },
      { path: "integrations", label: "Integrations", icon: Plug },
      { path: "workspace-admin", label: "Administration", icon: Building2 },
      { path: "billing", label: "Billing", icon: CreditCard },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { route, navigate } = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications.list(),
    refetchInterval: 30000,
  });

  const currentPath = route.segments[0] ?? "dashboard";
  const unreadCount = notifications.filter((n) => !n.read).length;

  const Sidebar = (
    <div className="flex h-full flex-col">
      {/* Workspace header */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white shadow-lg shadow-emerald-500/20">
          B
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold tracking-tight text-zinc-50">BIHARI AI</div>
          <div className="truncate text-[0.65rem] text-zinc-500">{user?.workspaceName}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="mb-1.5 px-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-600">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = currentPath === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-zinc-800 text-zinc-50"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-400"
                      )}
                    />
                    <span className="flex-1 text-left font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[0.65rem] font-bold text-amber-950">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Upgrade card */}
      <div className="px-3 pb-3">
        <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-200">Pro Plan</span>
          </div>
          <p className="mb-2 text-[0.7rem] leading-relaxed text-zinc-400">
            2.6M / 10M tokens used this month
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: "26%" }} />
          </div>
        </div>
      </div>

      {/* User */}
      <div className="relative border-t border-zinc-800 p-3">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-zinc-800/50"
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ backgroundColor: user?.avatarColor || "#10b981" }}
          >
            {user?.name?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate text-xs font-semibold text-zinc-200">{user?.name}</div>
            <div className="truncate text-[0.65rem] text-zinc-500">{user?.email}</div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        </button>
        {userMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
            <button
              onClick={() => { navigate("settings"); setUserMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <Settings className="h-3.5 w-3.5" /> Settings
            </button>
            <button
              onClick={() => logout()}
              className="flex w-full items-center gap-2 border-t border-zinc-800 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-zinc-800"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-zinc-800 bg-zinc-950 lg:block">
        {Sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-800 bg-zinc-950 lg:hidden">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 text-zinc-400 hover:text-zinc-200"
            >
              <X className="h-5 w-5" />
            </button>
            {Sidebar}
          </aside>
        </>
      )}

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-zinc-400 hover:text-zinc-200 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search */}
          <div className="relative hidden flex-1 sm:block sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              placeholder="Search employees, tasks, approvals…"
              className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-12 text-xs text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-700"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.6rem] text-zinc-500">
              ⌘K
            </kbd>
          </div>

          <div className="flex flex-1 items-center justify-end gap-1 sm:flex-initial">
            <button
              onClick={() => navigate("employees")}
              className="hidden items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 sm:flex"
            >
              <Plus className="h-3.5 w-3.5" />
              Hire Employee
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[0.6rem] font-bold text-amber-950">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-1 w-80 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
                      <span className="text-xs font-semibold text-zinc-200">Notifications</span>
                      <span className="text-[0.65rem] text-zinc-500">{unreadCount} unread</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.slice(0, 5).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            if (n.referenceType === "approval") navigate("approvals");
                            else if (n.referenceType === "task") navigate("tasks");
                            else navigate("employees");
                            setNotifOpen(false);
                          }}
                          className="flex w-full gap-2.5 border-b border-zinc-800/50 px-4 py-3 text-left transition-colors hover:bg-zinc-800/50"
                        >
                          {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}
                          <div className={cn("min-w-0 flex-1", n.read && "pl-4")}>
                            <div className="text-xs font-medium text-zinc-200">{n.title}</div>
                            <div className="truncate text-[0.7rem] text-zinc-500">{n.body}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

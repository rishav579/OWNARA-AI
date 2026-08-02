"use client";

import { useState } from "react";
import { useRouter, formatNumber, formatDate } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  Avatar,
  EmployeeStatusBadge,
  EmployeeStateBadge,
  EmptyState,
  ProgressBar,
  ErrorState,
  EmployeeGridSkeleton,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import { Bot, Plus, Search, MoreVertical, Sparkles, Mail, Clock, CheckCircle2 } from "lucide-react";
import { TOOL_LABELS } from "@/lib/app/data";

function formatINRfinance(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)} L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

const TEMPLATES = [
  {
    id: "finance",
    name: "Finance Employee",
    role: "finance_employee",
    description: "Processes overdue invoices, generates collection reminders, and manages accounts receivable — all under human approval.",
    defaultJobDescription: "Review overdue invoices, assess customer risk, calculate aging, and generate collection reminders. Always require human approval before sending any customer communication.",
    tools: ["generate_reminder", "send_reminder", "update_collection_case", "search_knowledge"],
    approvalRules: { generate_reminder: "non_critical", send_reminder: "critical", update_collection_case: "non_critical", search_knowledge: "non_critical" },
    enabled: true,
    badge: "Available now",
  },
];

type EmployeeStatus = "draft" | "active" | "paused" | "retired";

const STATUS_FILTERS: { label: string; value: EmployeeStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Retired", value: "retired" },
];

export function EmployeesPage() {
  const { navigate } = useRouter();
  const [filter, setFilter] = useState<EmployeeStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [showHire, setShowHire] = useState(false);
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["employees", filter, query],
    queryFn: () => api.employees.list({ status: filter, q: query || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.employees.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setShowHire(false);
    },
  });

  return (
    <div>
      <PageHeader
        title="AI Employees"
        description={isLoading ? undefined : `${employees.filter((e: any) => e.status === "active").length} active · ${employees.length} total`}
        actions={
          <button
            onClick={() => setShowHire(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Hire Employee</span>
            <span className="sm:hidden">Hire</span>
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                filter === f.value
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employees…"
            className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-xs text-zinc-200 outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <EmployeeGridSkeleton />
      ) : isError ? (
        <ErrorState message="Failed to load employees" cause="The server may be unreachable or your session may have expired." action="Try refreshing the page." onRetry={() => refetch()} />
      ) : employees.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No AI Employees yet"
          description="Hire your first AI Employee to start automating work. Finance Employees process overdue invoices, generate reminders, and recover payments — all under your approval."
          action={
            <button
              onClick={() => navigate("onboarding")}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              <Sparkles className="h-4 w-4" /> Start Onboarding
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((e: any) => (
            <div
              key={e.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`employees/${e.id}`)}
              onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); navigate(`employees/${e.id}`); } }}
              className="group cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900"
            >
              {/* Header: Avatar + Name + Role + Status */}
              <div className="flex items-start gap-3">
                <Avatar name={e.name} color={e.avatarColor} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-zinc-100">{e.name}</h3>
                    <EmployeeStatusBadge status={e.status} />
                  </div>
                  <p className="truncate text-xs text-zinc-500">{e.roleName}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {e.currentTaskTitle ? (
                      <span className="truncate text-[0.7rem] text-emerald-400">
                        ● {e.currentTaskTitle}
                      </span>
                    ) : (
                      <EmployeeStateBadge state={e.state} />
                    )}
                  </div>
                </div>
                {e.pendingApprovals > 0 && (
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-medium text-amber-400">
                    {e.pendingApprovals} pending
                  </span>
                )}
              </div>

              {/* ─── Business Metrics (FIRST, not XP/token) ─── */}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3">
                <div className="text-center">
                  <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">Trust</div>
                  <div className={`mt-0.5 text-base font-bold ${e.trustScore >= 80 ? "text-emerald-400" : e.trustScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                    {e.trustScore.toFixed(0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">Automated</div>
                  <div className="mt-0.5 text-base font-bold text-zinc-100">{e.tasksAutomated}</div>
                </div>
                <div className="text-center">
                  <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">Recovered</div>
                  <div className="mt-0.5 text-base font-bold text-emerald-400">
                    {e.moneyRecovered > 0 ? formatINRfinance(e.moneyRecovered) : "—"}
                  </div>
                </div>
              </div>

              {/* Secondary metrics */}
              <div className="mt-3 flex items-center justify-between text-[0.65rem] text-zinc-500">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {e.emailsSent} emails
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {e.hoursSaved.toFixed(1)}h saved
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {(e.approvalRate * 100).toFixed(0)}% approved
                </span>
              </div>

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3 text-xs text-zinc-500">
                <span>Lv{e.level} {e.title}</span>
                <span>Hired {formatDate(e.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hire modal */}
      {showHire && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowHire(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-800 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-50">Hire an AI Employee</h2>
              <p className="text-sm text-zinc-400">Choose a role template to get started</p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              <div className="space-y-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (!t.enabled) return;
                      createMutation.mutate({
                        name: t.name === "Finance Employee" ? "Kavya" : t.name.split(" ").map((w: string) => w[0]).join("") + " " + (Math.floor(Math.random() * 100)),
                        role: t.role,
                        jobDescription: t.defaultJobDescription,
                        operatingBoundaries: t.role === "finance_employee" ? [
                          "Never send a reminder without human approval",
                          "Never modify invoice amounts or payment records",
                          "Always cite invoice number and outstanding amount in reminders",
                          "Escalate to manager after 3 unanswered reminders",
                          "Never write off an invoice without explicit owner approval",
                        ] : ["Set boundaries during configuration"],
                        approvalRules: t.approvalRules,
                        toolNames: t.tools,
                      });
                    }}
                    disabled={createMutation.isPending || !t.enabled}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                      t.enabled
                        ? "border-zinc-800 bg-zinc-900/50 hover:border-emerald-500/40 hover:bg-zinc-900"
                        : "border-zinc-800/50 bg-zinc-900/30 opacity-60 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      t.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                    )}>
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{t.name}</h3>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[0.6rem] font-medium",
                          t.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                        )}>
                          {t.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">{t.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.tools.map((tool: string) => (
                          <span key={tool} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[0.6rem] text-zinc-400">
                            {TOOL_LABELS[tool] || tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-3">
              <span className="text-xs text-zinc-500">1 role available</span>
              <button
                onClick={() => setShowHire(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

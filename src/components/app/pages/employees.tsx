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
import { Bot, Plus, Search, MoreVertical } from "lucide-react";

const TEMPLATES = [
  {
    id: "t_csa",
    name: "Customer Support Agent",
    description: "Drafts and routes customer replies under human approval.",
    defaultJobDescription: "Draft replies to customer queries about orders, returns, and product information. Route complex billing issues to the finance team.",
    tools: ["draft_response", "send_email", "search_knowledge", "summarize"],
    approvalRules: { send_email: "critical", draft_response: "non_critical", search_knowledge: "non_critical", summarize: "non_critical" },
  },
  {
    id: "t_sdr",
    name: "Sales Development Rep",
    description: "Researches prospects and drafts personalized outreach emails.",
    defaultJobDescription: "Research prospects and draft personalized outreach emails. Follow up on replies and schedule demos.",
    tools: ["draft_response", "send_email", "search_knowledge", "summarize"],
    approvalRules: { send_email: "critical", draft_response: "non_critical", search_knowledge: "non_critical", summarize: "non_critical" },
  },
  {
    id: "t_ra",
    name: "Research Analyst",
    description: "Researches market trends and produces briefings for leadership.",
    defaultJobDescription: "Research market trends, competitor moves, and industry reports. Summarize findings into briefings for the leadership team.",
    tools: ["search_knowledge", "summarize", "draft_response"],
    approvalRules: { draft_response: "non_critical", search_knowledge: "non_critical", summarize: "non_critical" },
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
        description={`${employees.filter((e: any) => e.status === "active").length} active · ${employees.length} total`}
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
        <ErrorState message="Failed to load employees" onRetry={() => refetch()} />
      ) : employees.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No employees found"
          description="Try adjusting your filters or hire a new AI Employee."
          action={
            <button
              onClick={() => setShowHire(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" /> Hire Employee
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
              <div className="flex items-start gap-3">
                <Avatar name={e.name} color={e.avatarColor} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-zinc-100">{e.name}</h3>
                  </div>
                  <p className="truncate text-xs text-zinc-500">{e.roleName}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <EmployeeStatusBadge status={e.status} />
                  </div>
                </div>
                <span
                  onClick={(ev) => ev.stopPropagation()}
                  className="text-zinc-500 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <EmployeeStateBadge state={e.state} />
                {e.pendingApprovals > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-medium text-amber-400">
                    {e.pendingApprovals} pending
                  </span>
                )}
              </div>

              <div className="mt-4 border-t border-zinc-800 pt-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Token usage</span>
                  <span className="font-mono text-zinc-400">
                    {formatNumber(e.tokenUsage)} / {formatNumber(e.tokenCap)}
                  </span>
                </div>
                <ProgressBar
                  value={e.tokenUsage}
                  max={e.tokenCap}
                  color={e.tokenUsage / e.tokenCap > 0.8 ? "#f59e0b" : "#10b981"}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>{e.completedTasks} tasks completed</span>
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
                      createMutation.mutate({
                        name: t.name.split(" ").map((w: string) => w[0]).join("") + " " + (Math.floor(Math.random() * 100)),
                        templateId: t.id,
                        jobDescription: t.defaultJobDescription,
                        operatingBoundaries: ["Set boundaries during configuration"],
                        approvalRules: t.approvalRules,
                        toolNames: t.tools,
                      });
                    }}
                    disabled={createMutation.isPending}
                    className="flex w-full items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition-colors hover:border-emerald-500/40 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{t.name}</h3>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">{t.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.tools.map((tool: string) => (
                          <span key={tool} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.6rem] text-zinc-400">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-3">
              <span className="text-xs text-zinc-500">3 templates available</span>
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

"use client";

import { useState } from "react";
import { useRouter, formatNumber, formatDateTime, formatRelativeTime } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  TaskStatusBadge,
  PriorityBadge,
  Avatar,
  EmptyState,
  ProgressBar,
  ErrorState,
  ListSkeleton,
  StepTypeBadge,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  ListTodo,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Zap,
  Lock,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Brain,
  Scale,
  BookOpen,
  X,
} from "lucide-react";

type TaskStatus = "queued" | "assigned" | "planning" | "executing" | "waiting_approval" | "completed" | "failed" | "paused" | "stopped";

const STATUS_FILTERS: { label: string; value: TaskStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "In Progress", value: "executing" },
  { label: "Waiting", value: "waiting_approval" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

const STEP_ICONS = {
  plan: Brain,
  reasoning: Brain,
  tool_call: Zap,
  approval_gate: Lock,
} as const;

export function TasksPage() {
  const { navigate } = useRouter();
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ employeeId: "", title: "", description: "", stepCap: 20, tokenCap: 100000, priority: "medium" });
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["tasks", filter],
    queryFn: () => api.tasks.list({ status: filter }),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", "active"],
    queryFn: () => api.employees.list({ status: "active" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.tasks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setShowCreate(false);
    },
  });

  // Fetch timeline for expanded task
  const { data: timeline = [] } = useQuery({
    queryKey: ["task-timeline", expandedId],
    queryFn: () => api.tasks.timeline(expandedId!),
    enabled: !!expandedId,
  });

  const filtered = tasks.filter((t: any) => {
    if (!query) return true;
    return t.title.toLowerCase().includes(query.toLowerCase()) || t.employeeName.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={`${tasks.length} total · ${tasks.filter((t: any) => t.status === "waiting_approval").length} waiting approval`}
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors",
                filter === f.value ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
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
            placeholder="Search tasks…"
            className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-xs text-zinc-200 outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      {/* Task list */}
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Failed to load tasks" onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks found"
          description="Assign a new task to an AI Employee to get started."
          action={
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
              <Plus className="h-4 w-4" /> New Task
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const employee = employees.find((e: any) => e.id === t.employeeId);
            const isExpanded = expandedId === t.id;
            const tokenPct = (t.tokenUsage / t.tokenCap) * 100;
            return (
              <div key={t.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-800/30"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-100">{t.title}</span>
                      <TaskStatusBadge status={t.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                      {employee && <span className="flex items-center gap-1"><Avatar name={employee.name} color={employee.avatarColor} size="sm" /> {employee.name}</span>}
                      <span>{t.stepCount}/{t.stepCap} steps</span>
                      <span>{formatNumber(t.tokenUsage)} tokens</span>
                      <PriorityBadge priority={t.priority} />
                      <span>{formatRelativeTime(t.startedAt)}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded view: timeline */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 bg-zinc-950/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Task Timeline — Explainability</h4>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Zap className="h-3 w-3" /> {formatNumber(t.tokenUsage)} / {formatNumber(t.tokenCap)} tokens
                      </div>
                    </div>
                    <div className="mb-4">
                      <ProgressBar value={t.tokenUsage} max={t.tokenCap} color={tokenPct > 80 ? "#f59e0b" : "#10b981"} />
                    </div>
                    <div className="space-y-3">
                      {timeline.map((step: any) => {
                        const Icon = STEP_ICONS[step.stepType as keyof typeof STEP_ICONS] || FileText;
                        return (
                          <div key={step.stepNumber} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                                step.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                                step.status === "pending" ? "bg-zinc-800 text-zinc-500" :
                                step.status === "running" ? "bg-sky-500/10 text-sky-400" :
                                "bg-red-500/10 text-red-400"
                              )}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              {step.stepNumber < timeline.length && (
                                <div className="my-1 w-px flex-1 bg-zinc-800" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 pb-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs text-zinc-500">Step {step.stepNumber}</span>
                                <StepTypeBadge type={step.stepType} />
                                {step.input?.tool && (
                                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.6rem] text-emerald-400">
                                    {step.input.tool}
                                  </span>
                                )}
                                {step.confidence != null && (
                                  <span className="flex items-center gap-1 text-[0.6rem] text-zinc-500">
                                    <span className={cn("h-1.5 w-1.5 rounded-full", step.confidence >= 0.85 ? "bg-emerald-500" : step.confidence >= 0.7 ? "bg-amber-500" : "bg-red-500")} />
                                    {Math.round(step.confidence * 100)}% confidence
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm leading-relaxed text-zinc-300">{step.reasoning}</p>
                              {step.policyRefs && step.policyRefs.length > 0 && (
                                <div className="mt-2 flex items-center gap-1.5">
                                  <Scale className="h-3 w-3 text-violet-400" />
                                  {step.policyRefs.map((p: string) => (
                                    <span key={p} className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[0.6rem] text-violet-300">{p}</span>
                                  ))}
                                  <span className="text-[0.6rem] text-zinc-500">policy checked</span>
                                </div>
                              )}
                              {step.knowledgeRefs && step.knowledgeRefs.length > 0 && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <BookOpen className="h-3 w-3 text-teal-400" />
                                  {step.knowledgeRefs.map((k: string, i: number) => (
                                    <span key={i} className="rounded border border-teal-500/30 bg-teal-500/10 px-1.5 py-0.5 font-mono text-[0.6rem] text-teal-300">{k}</span>
                                  ))}
                                </div>
                              )}
                              {step.output && (
                                <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                                  <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Output</div>
                                  <p className="text-xs leading-relaxed text-zinc-400 line-clamp-3">
                                    {typeof step.output === "string" ? step.output : JSON.stringify(step.output).slice(0, 200)}
                                  </p>
                                </div>
                              )}
                              {step.status === "completed" && (
                                <div className="mt-1.5 flex items-center gap-3 text-[0.65rem] text-zinc-600">
                                  <span>{step.tokens} tokens</span>
                                  <span>{(step.durationMs / 1000).toFixed(1)}s</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {t.status === "waiting_approval" && (
                      <button
                        onClick={() => navigate("approvals")}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-400"
                      >
                        <Lock className="h-3.5 w-3.5" /> Review pending approval
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create task modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-50">New Task</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-400 hover:text-zinc-200"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Assign to</label>
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                >
                  <option value="">Select an employee…</option>
                  {employees.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.name} — {e.roleName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Draft replies to today's customer queries"
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Description</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe what the AI Employee should do…"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Step cap</label>
                  <input type="number" value={form.stepCap} onChange={(e) => setForm({ ...form, stepCap: parseInt(e.target.value) || 20 })} className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Token cap</label>
                  <input type="number" value={form.tokenCap} onChange={(e) => setForm({ ...form, tokenCap: parseInt(e.target.value) || 100000 })} className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-800 px-6 py-3">
              <button onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200">Cancel</button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.employeeId || !form.title}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {createMutation.isPending ? "Assigning…" : "Assign task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

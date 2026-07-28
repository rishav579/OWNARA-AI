"use client";

import { useState } from "react";
import { useRouter, formatNumber, formatDate, formatDateTime } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TOOL_LABELS } from "@/lib/app/data";
import {
  Avatar,
  EmployeeStatusBadge,
  EmployeeStateBadge,
  TaskStatusBadge,
  CriticalityBadge,
  ProgressBar,
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Pause,
  Play,
  MoreVertical,
  Bot,
  ListTodo,
  Shield,
  BookOpen,
  Settings,
  Activity,
  Zap,
  Lock,
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "tools", label: "Tools", icon: Shield },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "config", label: "Configuration", icon: Settings },
] as const;

export function EmployeeDetailPage({ employeeId }: { employeeId: string }) {
  const { navigate } = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const queryClient = useQueryClient();

  const { data: employee, isLoading, isError, refetch } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => api.employees.get(employeeId),
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.employees.pause(employeeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", employeeId] }),
  });
  const resumeMutation = useMutation({
    mutationFn: () => api.employees.resume(employeeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", employeeId] }),
  });

  if (isLoading) return <ListSkeleton rows={6} />;
  if (isError || !employee) {
    return (
      <EmptyState
        icon={Bot}
        title="Employee not found"
        description="This employee may have been retired or does not exist."
        action={
          <button onClick={() => navigate("employees")} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
            Back to employees
          </button>
        }
      />
    );
  }

  const employeeTasks = employee.tasks || [];
  const employeeDocs = employee.documents || [];
  const tokenPct = (employee.tokenUsage / employee.tokenCap) * 100;

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate("employees")}
        className="mb-4 flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All employees
      </button>

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 sm:flex-row sm:items-center">
        <Avatar name={employee.name} color={employee.avatarColor} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-50">{employee.name}</h1>
            <EmployeeStatusBadge status={employee.status} />
          </div>
          <p className="mt-0.5 text-sm text-zinc-400">{employee.roleName}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> <EmployeeStateBadge state={employee.state} /></span>
            <span>·</span>
            <span>{employee.completedTasks} tasks completed</span>
            <span>·</span>
            <span>Hired {formatDate(employee.createdAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {employee.status === "active" ? (
            <button
              onClick={() => pauseMutation.mutate()}
              disabled={pauseMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 disabled:opacity-50"
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
          ) : employee.status === "paused" ? (
            <button
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" /> Resume
            </button>
          ) : null}
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:border-zinc-700">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500"><ListTodo className="h-3.5 w-3.5" /> Tasks</div>
          <div className="mt-1 text-lg font-bold text-zinc-50">{employee.taskCount}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500"><Lock className="h-3.5 w-3.5" /> Pending</div>
          <div className="mt-1 text-lg font-bold text-amber-400">{employee.pendingApprovals}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500"><Zap className="h-3.5 w-3.5" /> Tokens</div>
          <div className="mt-1 text-lg font-bold text-zinc-50">{formatNumber(employee.tokenUsage)}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500"><BookOpen className="h-3.5 w-3.5" /> Documents</div>
          <div className="mt-1 text-lg font-bold text-zinc-50">{employeeDocs.length}</div>
        </div>
      </div>

      {/* Token usage bar */}
      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-zinc-400">Token budget usage</span>
          <span className="font-mono text-zinc-500">
            {formatNumber(employee.tokenUsage)} / {formatNumber(employee.tokenCap)} ({tokenPct.toFixed(1)}%)
          </span>
        </div>
        <ProgressBar value={employee.tokenUsage} max={employee.tokenCap} color={tokenPct > 80 ? "#f59e0b" : "#10b981"} />
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-zinc-800">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-emerald-500 text-zinc-100"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {/* Overview tab */}
        {tab === "overview" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">Job Description</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{employee.jobDescription}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h3 className="mb-3 text-sm font-semibold text-zinc-100">Operating Boundaries</h3>
              <ul className="space-y-2">
                {employee.boundaries.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h3 className="mb-3 text-sm font-semibold text-zinc-100">Approval Rules</h3>
              <div className="space-y-2">
                {Object.entries(employee.approvalRules).map(([tool, crit]) => (
                  <div key={tool} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                    <span className="font-mono text-xs text-zinc-300">{TOOL_LABELS[tool] || tool}</span>
                    <CriticalityBadge criticality={crit} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tasks tab */}
        {tab === "tasks" && (
          <div className="space-y-2">
            {employeeTasks.length === 0 ? (
              <EmptyState icon={ListTodo} title="No tasks yet" description="Assign a task to this employee to get started." />
            ) : (
              employeeTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate("tasks")}
                  className="flex w-full items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-left transition-colors hover:border-zinc-700"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-200">{t.title}</span>
                      <TaskStatusBadge status={t.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                      <span>{t.stepCount}/{t.stepCap} steps</span>
                      <span>{formatNumber(t.tokenUsage)} tokens</span>
                      <span>{formatDateTime(t.startedAt)}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Tools tab */}
        {tab === "tools" && (
          <div className="space-y-2">
            {employee.tools.map((toolName) => {
              const crit = employee.approvalRules[toolName] || "non_critical";
              return (
                <div key={toolName} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", crit === "critical" ? "bg-amber-500/10 text-amber-400" : "bg-zinc-800 text-zinc-400")}>
                      <Shield className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-200">{TOOL_LABELS[toolName] || toolName}</div>
                      <div className="font-mono text-xs text-zinc-500">{toolName}</div>
                    </div>
                  </div>
                  <CriticalityBadge criticality={crit} />
                </div>
              );
            })}
          </div>
        )}

        {/* Knowledge tab */}
        {tab === "knowledge" && (
          <div className="space-y-2">
            {employeeDocs.length === 0 ? (
              <EmptyState icon={BookOpen} title="No knowledge documents" description="Upload documents for this employee to ground its responses." />
            ) : (
              employeeDocs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                    <BookOpen className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-200">{d.filename}</div>
                    <div className="text-xs text-zinc-500">{d.chunkCount} chunks · {formatDate(d.createdAt)}</div>
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    d.status === "ready" ? "bg-emerald-500/15 text-emerald-400" :
                    d.status === "processing" ? "bg-sky-500/15 text-sky-400" :
                    "bg-red-500/15 text-red-400"
                  )}>
                    {d.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Config tab */}
        {tab === "config" && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="mb-4 text-sm font-semibold text-zinc-100">Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Employee name</label>
                <input
                  defaultValue={employee.name}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Job description</label>
                <textarea
                  defaultValue={employee.jobDescription}
                  rows={4}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Token cap</label>
                <input
                  type="number"
                  defaultValue={employee.tokenCap}
                  className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400">
                  Save changes
                </button>
                <button className="rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-700">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

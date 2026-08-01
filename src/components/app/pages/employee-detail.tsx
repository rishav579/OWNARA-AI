"use client";

import { useState } from "react";
import { useRouter, formatNumber, formatDate, formatDateTime, formatINR } from "@/lib/app/router";
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
  TrustScoreBadge,
  ConfidenceBar,
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
  Award,
  TrendingUp,
  Brain,
  Sparkles,
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "career", label: "Career", icon: Award },
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

  // Career profile (XP, level, trust, KPIs, skills, memory, capabilities)
  // Loaded lazily — only fetched when the Career tab is opened.
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["employee", employeeId, "profile"],
    queryFn: () => api.employees.profile(employeeId),
    enabled: tab === "career",
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
            {/* Trust Score & Business Metrics */}
            {employee.trustScore && (
              <div className="grid gap-4 lg:grid-cols-3">
                {/* Trust Score */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-100">Trust Score</h3>
                  <TrustScoreBadge score={employee.trustScore.overallScore} trend={employee.trustScore.trend} delta={employee.trustScore.trendDelta} />
                  <div className="mt-4 space-y-3">
                    <ConfidenceBar value={employee.trustScore.successRate} label="Success Rate" />
                    <ConfidenceBar value={employee.trustScore.approvalRate} label="Approval Rate" />
                    <ConfidenceBar value={employee.trustScore.accuracyScore} label="Accuracy" />
                  </div>
                </div>

                {/* Business Metrics */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 lg:col-span-2">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-100">Business Metrics</h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-zinc-500">Tasks Completed</div>
                      <div className="mt-1 text-2xl font-bold text-zinc-50">{employee.trustScore.tasksCompleted || employee.completedTasks}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Money Recovered</div>
                      <div className="mt-1 text-2xl font-bold text-emerald-400">{formatINR(employee.trustScore.moneyRecoveredCents)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Human Corrections</div>
                      <div className="mt-1 text-2xl font-bold text-amber-400">{employee.trustScore.humanCorrections}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Policy Violations</div>
                      <div className="mt-1 text-2xl font-bold text-red-400">{employee.trustScore.policyViolations}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Current Activity</div>
                      <div className="mt-1 text-sm font-medium text-zinc-200">
                        {employee.state === "waiting_approval" ? "Awaiting approval" :
                         employee.state === "executing" ? "Executing task" :
                         employee.state === "planning" ? "Planning task" :
                         employee.state === "idle" ? "Idle — ready" :
                         employee.state === "paused" ? "Paused" : employee.state}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Accuracy Score</div>
                      <div className="mt-1 text-2xl font-bold text-zinc-50">{Math.round(employee.trustScore.accuracyScore * 100)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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

        {/* Career tab — Employee Profile Engine (EMP-001) */}
        {tab === "career" && (
          <CareerPanel profile={profile ?? undefined} loading={profileLoading} />
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

// ─── Career Panel (Employee Profile Engine — EMP-001) ─────────────────────────

interface SkillStat { name: string; level: number; confidence: number; usageCount: number }
interface ProfileData {
  level: number;
  title: string;
  experiencePoints: number;
  version: number;
  nextLevelXp?: number;
  progressToNextLevel?: number;
  completedTasks: number;
  successfulTasks: number;
  failedTasks: number;
  approvalRate: number;
  averageConfidence: number;
  averageExecutionTime: number;
  moneyRecovered: number;
  invoicesProcessed: number;
  customersHandled: number;
  emailsSent: number;
  tasksAutomated: number;
  hoursSaved: number;
  estimatedBusinessValue: number;
  trustScore: number;
  accuracyScore: number;
  consistencyScore: number;
  riskScore: number;
  hallucinationRate: number;
  humanInterventionRate: number;
  memoryCount: number;
  reinforcementCount: number;
  capabilitiesGranted: number;
  criticalCapabilities: number;
  skills: SkillStat[];
  lastTaskAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const LEVEL_LADDER = [
  { level: 1, title: "Intern", minXp: 0 },
  { level: 2, title: "Junior Employee", minXp: 50 },
  { level: 3, title: "Employee", minXp: 150 },
  { level: 4, title: "Senior Employee", minXp: 350 },
  { level: 5, title: "Lead Employee", minXp: 700 },
  { level: 6, title: "Principal Employee", minXp: 1200 },
  { level: 7, title: "Expert Employee", minXp: 2000 },
];

function CareerPanel({ profile, loading }: { profile?: ProfileData; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
        <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
      </div>
    );
  }
  if (!profile) {
    return (
      <EmptyState
        icon={Award}
        title="No career profile yet"
        description="This employee hasn't completed any tasks. The profile initializes on first activation."
      />
    );
  }

  const p = profile;
  const currentLevel = LEVEL_LADDER.find((l) => l.level === p.level) || LEVEL_LADDER[0];
  const nextLevel = LEVEL_LADDER.find((l) => l.level === p.level + 1);
  const progressPct = nextLevel
    ? Math.min(100, Math.round(((p.experiencePoints - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100))
    : 100;

  return (
    <div className="space-y-4">
      {/* ─── Level + XP Header ─── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-50">Level {p.level}</span>
                <span className="text-sm text-zinc-400">· {p.title}</span>
              </div>
              <div className="mt-0.5 font-mono text-xs text-zinc-500">
                {p.experiencePoints} XP · v{p.version} · updated {formatDateTime(p.updatedAt)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Trust Score</div>
            <div className={cn(
              "text-2xl font-bold",
              p.trustScore >= 80 ? "text-emerald-400" :
              p.trustScore >= 60 ? "text-amber-400" :
              "text-red-400"
            )}>
              {p.trustScore.toFixed(1)}
            </div>
            <div className="text-[0.6rem] text-zinc-500">/ 100</div>
          </div>
        </div>

        {/* Level progress bar */}
        {nextLevel ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Progress to <span className="text-zinc-200">{nextLevel.title}</span> (Lv{nextLevel.level})</span>
              <span className="font-mono text-zinc-500">
                {p.experiencePoints - currentLevel.minXp} / {nextLevel.minXp - currentLevel.minXp} XP
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mt-1 text-right text-[0.6rem] text-zinc-500">{progressPct}%</div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
            ★ Max level reached — Expert Employee
          </div>
        )}

        {/* Level ladder */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {LEVEL_LADDER.map((l) => (
            <span
              key={l.level}
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.6rem] font-medium",
                l.level === p.level
                  ? "bg-emerald-500/15 text-emerald-400"
                  : l.level < p.level
                  ? "bg-zinc-800 text-zinc-400"
                  : "bg-zinc-900 text-zinc-600"
              )}
              title={`${l.title} (${l.minXp} XP)`}
            >
              Lv{l.level} {l.title}
            </span>
          ))}
        </div>
      </div>

      {/* ─── KPIs ─── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
          <TrendingUp className="h-4 w-4 text-emerald-400" /> Business KPIs
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <KpiCell label="Tasks Completed" value={p.completedTasks} sub={`${p.failedTasks} failed`} />
          <KpiCell label="Tasks Automated" value={p.tasksAutomated} sub="manual work replaced" />
          <KpiCell label="Emails Sent" value={p.emailsSent} sub="automated" />
          <KpiCell label="Customers Handled" value={p.customersHandled} sub="unique" />
          <KpiCell label="Hours Saved" value={`${p.hoursSaved.toFixed(1)}h`} sub="vs manual" />
          <KpiCell label="Invoices Processed" value={p.invoicesProcessed} />
          <KpiCell
            label="Money Recovered"
            value={`₹${((p.moneyRecovered / 100) / 100000).toFixed(2)}L`}
            sub={p.moneyRecovered > 0 ? "realised" : "pending payments"}
            highlight={p.moneyRecovered > 0 ? "emerald" : undefined}
          />
          <KpiCell
            label="Business Value"
            value={`₹${((p.estimatedBusinessValue / 100) / 100000).toFixed(2)}L`}
            sub="estimated"
            highlight={p.estimatedBusinessValue > 0 ? "emerald" : undefined}
          />
        </div>
      </div>

      {/* ─── Quality + Memory + Capabilities ─── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Quality */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
            <Shield className="h-4 w-4 text-sky-400" /> Quality
          </div>
          <div className="space-y-3">
            <QualityBar label="Trust" value={p.trustScore} max={100} suffix="/100" color="emerald" />
            <QualityBar label="Accuracy" value={p.accuracyScore * 100} max={100} suffix="%" color="sky" />
            <QualityBar label="Consistency" value={p.consistencyScore * 100} max={100} suffix="%" color="violet" />
            <QualityBar label="Risk (lower is better)" value={100 - p.riskScore} max={100} suffix="% safe" color="emerald" />
            <QualityBar label="Hallucination-free" value={(1 - p.hallucinationRate) * 100} max={100} suffix="%" color="emerald" />
            <QualityBar label="Autonomy" value={(1 - p.humanInterventionRate) * 100} max={100} suffix="%" color="emerald" />
          </div>
        </div>

        {/* Memory */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
            <Brain className="h-4 w-4 text-violet-400" /> Memory & Learning
          </div>
          <div className="space-y-3">
            <StatRow label="Memories stored" value={p.memoryCount} />
            <StatRow label="Reinforcements" value={p.reinforcementCount} />
            <StatRow label="Avg confidence" value={`${(p.averageConfidence * 100).toFixed(0)}%`} />
            <StatRow label="Avg execution time" value={p.averageExecutionTime > 0 ? `${(p.averageExecutionTime / 1000).toFixed(1)}s` : "—"} />
            <StatRow label="Approval rate" value={`${(p.approvalRate * 100).toFixed(0)}%`} />
            <StatRow label="Last task at" value={p.lastTaskAt ? formatDateTime(p.lastTaskAt) : "—"} />
          </div>
        </div>

        {/* Capabilities */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
            <Lock className="h-4 w-4 text-amber-400" /> Capabilities
          </div>
          <div className="space-y-3">
            <StatRow label="Granted" value={p.capabilitiesGranted} />
            <StatRow label="Critical / high-risk" value={p.criticalCapabilities} highlight="amber" />
            <StatRow label="Profile version" value={`v${p.version}`} />
            <StatRow label="Created" value={formatDate(p.createdAt)} />
            <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs leading-relaxed text-zinc-500">
              Capabilities follow least-privilege: every tool execution is
              authorized against the employee's granted capabilities. Critical
              capabilities require explicit human approval before each use.
            </div>
          </div>
        </div>
      </div>

      {/* ─── Skills ─── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
          <Sparkles className="h-4 w-4 text-amber-400" /> Skills
          <span className="ml-auto text-xs font-normal text-zinc-500">
            {p.skills.length} tracked · auto-inferred from task patterns
          </span>
        </div>
        {p.skills.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
            No skills tracked yet. Skills are inferred automatically as the employee completes tasks.
          </div>
        ) : (
          <div className="space-y-2.5">
            {p.skills.map((s) => (
              <div key={s.name} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-100">{s.name}</span>
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold",
                      s.level >= 7 ? "bg-amber-500/15 text-amber-400" :
                      s.level >= 4 ? "bg-emerald-500/15 text-emerald-400" :
                      "bg-zinc-800 text-zinc-400"
                    )}>
                      Lv{s.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[0.65rem] text-zinc-500">
                    <span>{s.usageCount} uses</span>
                    <span>{(s.confidence * 100).toFixed(0)}% conf</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                    style={{ width: `${Math.min(100, (s.level / 10) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: "emerald";
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="text-[0.65rem] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={cn(
        "mt-1 text-xl font-bold",
        highlight === "emerald" ? "text-emerald-400" : "text-zinc-50"
      )}>
        {value}
      </div>
      {sub && <div className="text-[0.6rem] text-zinc-500">{sub}</div>}
    </div>
  );
}

function QualityBar({
  label,
  value,
  max,
  suffix,
  color,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  color: "emerald" | "sky" | "violet";
}) {
  const pct = Math.min(100, (value / max) * 100);
  const colorClass =
    color === "emerald" ? "from-emerald-500 to-emerald-400" :
    color === "sky" ? "from-sky-500 to-sky-400" :
    "from-violet-500 to-violet-400";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-300">{pct.toFixed(0)}{suffix}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className={cn("h-full rounded-full bg-gradient-to-r", colorClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "amber";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className={cn("font-medium", highlight === "amber" ? "text-amber-400" : "text-zinc-100")}>
        {value}
      </span>
    </div>
  );
}

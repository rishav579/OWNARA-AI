"use client";

import { useRouter, formatRelativeTime, formatNumber, formatINR } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  StatCard,
  BarChart,
  DonutChart,
  PageHeader,
  Avatar,
  EmployeeStateBadge,
  EmployeeStatusBadge,
  ErrorState,
  PageSkeleton,
  SeverityDot,
  CategoryBadge,
  TrustScoreBadge,
} from "@/components/app/ui";
import {
  Bot,
  ShieldCheck,
  ListTodo,
  Zap,
  ArrowRight,
  Lock,
  FileText,
  CheckCircle2,
  XCircle,
  Scale,
} from "lucide-react";

export function DashboardPage() {
  const { navigate } = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard.get(),
  });

  if (isLoading) return <PageSkeleton variant="dashboard" />;
  if (isError || !data) return <ErrorState message="Failed to load dashboard" onRetry={() => refetch()} />;

  const pendingApprovals = data.approvals.pendingList;
  const activeEmployees = data.employees.list;
  const recentAudit = data.recentActivity;
  const barData = data.taskActivity.map((d: any) => ({ label: d.day.replace("Jan ", ""), value: d.tasks }));
  const tokenPct = (data.tokens.usedThisMonth / 10000000) * 100;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your AI Employee workspace at a glance"
        actions={
          <button
            onClick={() => navigate("employees")}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Hire Employee</span>
            <span className="sm:hidden">Hire</span>
          </button>
        }
      />

      {/* Pending approval banner */}
      {pendingApprovals.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <Lock className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100">
                {pendingApprovals.length} approvals waiting for you
              </div>
              <div className="text-xs text-zinc-400">
                AI Employees are paused until you review
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate("approvals")}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-400"
          >
            Review now
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active Employees" value={String(data.employees.active)} icon={Bot} trend="up" trendValue="+1 this week" accent="emerald" />
        <StatCard label="Pending Approvals" value={String(data.approvals.pending)} icon={ShieldCheck} trend="flat" trendValue={`${data.approvals.pending} awaiting`} accent="amber" />
        <StatCard label="Tasks This Month" value={String(data.tasks.total)} icon={ListTodo} trend="up" trendValue="+12%" accent="violet" />
        <StatCard label="Token Cost" value={formatINR(data.tokens.costCentsThisMonth)} icon={Zap} trend="down" trendValue="-8%" accent="sky" />
      </div>

      {/* Charts row */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Task Activity</h3>
              <p className="text-xs text-zinc-500">Tasks completed per day — last 14 days</p>
            </div>
            <span className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400">14d</span>
          </div>
          <BarChart data={barData} color="#10b981" height={160} />
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Token Usage</h3>
          <p className="text-xs text-zinc-500">By employee — this month</p>
          <div className="mt-5 flex justify-center">
            <DonutChart data={data.tokens.byEmployee} />
          </div>
        </div>
      </div>

      {/* Trust Scores */}
      {data.trustScores && data.trustScores.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Scale className="h-4 w-4 text-emerald-400" />
              AI Employee Trust Scores
            </h3>
            <span className="text-xs text-zinc-500">{data.activePolicies || 0} active policies</span>
          </div>
          <div className="grid divide-y divide-zinc-800/50 sm:grid-cols-2 sm:divide-y-0 sm:divide-x sm:divide-zinc-800/50">
            {data.trustScores.slice(0, 4).map((ts: any) => (
              <button
                key={ts.employeeId}
                onClick={() => navigate(`employees/${ts.employeeId}`)}
                className="flex items-center gap-3 p-4 text-left transition-colors hover:bg-zinc-800/30"
              >
                <Avatar name={ts.employeeName} color={ts.avatarColor} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-200">{ts.employeeName}</div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <span>{Math.round(ts.successRate * 100)}% success</span>
                    <span>·</span>
                    <span>{ts.policyViolations} violations</span>
                  </div>
                </div>
                <TrustScoreBadge score={ts.overallScore} trend={ts.trend} delta={ts.trendDelta} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Two-column: approvals + employees */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-zinc-100">Pending Approvals</h3>
            <button onClick={() => navigate("approvals")} className="text-xs text-emerald-400 hover:text-emerald-300">View all →</button>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {pendingApprovals.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-500">No pending approvals</div>
            ) : (
              pendingApprovals.map((a: any) => (
                <button key={a.id} onClick={() => navigate("approvals")} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-zinc-800/30">
                  <Avatar name={a.employeeName} color={a.employeeColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-200">{a.employeeName}</div>
                    <div className="truncate text-xs text-zinc-500">{a.toolDisplayName} → {a.to}</div>
                  </div>
                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-zinc-100">Employee Status</h3>
            <button onClick={() => navigate("employees")} className="text-xs text-emerald-400 hover:text-emerald-300">View all →</button>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {activeEmployees.map((e: any) => (
              <button key={e.id} onClick={() => navigate(`employees/${e.id}`)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-zinc-800/30">
                <Avatar name={e.name} color={e.avatarColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-200">{e.name}</span>
                    <EmployeeStatusBadge status={e.status} />
                  </div>
                  <div className="truncate text-xs text-zinc-500">{e.roleName}</div>
                </div>
                <EmployeeStateBadge state={e.state} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Business Activity Feed */}
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-zinc-100">Business Activity</h3>
          <button onClick={() => navigate("audit")} className="text-xs text-emerald-400 hover:text-emerald-300">Full audit trail →</button>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {(data.businessFeed || recentAudit).map((entry: any) => (
            <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
              <SeverityDot severity={entry.severity || "info"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">{entry.businessEvent || entry.entryType.replace(/_/g, " ")}</span>
                  <CategoryBadge category={entry.category || "system"} />
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                  {entry.businessDescription || `${entry.actorName} performed an action`}
                </div>
              </div>
              <span className="shrink-0 text-xs text-zinc-500">{formatRelativeTime(entry.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Token budget */}
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Monthly Token Budget</h3>
            <p className="text-xs text-zinc-500">10M tokens included in your Pro plan</p>
          </div>
          <button onClick={() => navigate("billing")} className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700">Manage plan</button>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-zinc-400">{formatNumber(data.tokens.usedThisMonth)} / 10M tokens</span>
            <span className="font-mono text-zinc-500">{tokenPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${tokenPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter, formatRelativeTime, formatNumber, formatINR } from "@/lib/app/router";
import {
  DASHBOARD_STATS,
  TASK_ACTIVITY,
  TOKEN_USAGE_BY_EMPLOYEE,
  EMPLOYEES,
  APPROVALS,
  AUDIT_ENTRIES,
} from "@/lib/app/data";
import {
  StatCard,
  BarChart,
  DonutChart,
  PageHeader,
  Avatar,
  ApprovalStatusBadge,
  EmployeeStateBadge,
  EmployeeStatusBadge,
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
  Clock,
} from "lucide-react";

export function DashboardPage() {
  const { navigate } = useRouter();
  const pendingApprovals = APPROVALS.filter((a) => a.status === "pending");
  const activeEmployees = EMPLOYEES.filter((e) => e.status === "active");
  const recentAudit = AUDIT_ENTRIES.slice(0, 6);
  const barData = TASK_ACTIVITY.map((d) => ({ label: d.day.replace("Jan ", ""), value: d.tasks }));
  const tokenPct = (DASHBOARD_STATS.tokens.usedThisMonth / 10000000) * 100;

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
        <StatCard
          label="Active Employees"
          value={String(DASHBOARD_STATS.employees.active)}
          icon={Bot}
          trend="up"
          trendValue="+1 this week"
          accent="emerald"
        />
        <StatCard
          label="Pending Approvals"
          value={String(DASHBOARD_STATS.approvals.pending)}
          icon={ShieldCheck}
          trend="flat"
          trendValue="2 awaiting"
          accent="amber"
        />
        <StatCard
          label="Tasks This Month"
          value={String(DASHBOARD_STATS.tasks.total)}
          icon={ListTodo}
          trend="up"
          trendValue="+12%"
          accent="violet"
        />
        <StatCard
          label="Token Cost"
          value={formatINR(DASHBOARD_STATS.tokens.costCentsThisMonth)}
          icon={Zap}
          trend="down"
          trendValue="-8%"
          accent="sky"
        />
      </div>

      {/* Charts row */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Task activity */}
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

        {/* Token usage donut */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Token Usage</h3>
          <p className="text-xs text-zinc-500">By employee — this month</p>
          <div className="mt-5 flex justify-center">
            <DonutChart data={TOKEN_USAGE_BY_EMPLOYEE} />
          </div>
        </div>
      </div>

      {/* Two-column: approvals + activity */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Pending approvals */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-zinc-100">Pending Approvals</h3>
            <button
              onClick={() => navigate("approvals")}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {pendingApprovals.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate("approvals")}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-zinc-800/30"
              >
                <Avatar name={a.employeeName} color="#10b981" size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-200">{a.employeeName}</div>
                  <div className="truncate text-xs text-zinc-500">
                    {a.toolDisplayName} → {a.proposedAction.to || a.proposedAction.subject || "Draft"}
                  </div>
                </div>
                <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              </button>
            ))}
            {pendingApprovals.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-zinc-500">No pending approvals</div>
            )}
          </div>
        </div>

        {/* Employee status */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-zinc-100">Employee Status</h3>
            <button
              onClick={() => navigate("employees")}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {activeEmployees.map((e) => (
              <button
                key={e.id}
                onClick={() => navigate(`employees/${e.id}`)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-zinc-800/30"
              >
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

      {/* Recent activity */}
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-zinc-100">Recent Activity</h3>
          <button
            onClick={() => navigate("audit")}
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            Full audit trail →
          </button>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {recentAudit.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  entry.entryType.includes("approval") ? "bg-amber-500/10 text-amber-400" :
                  entry.entryType.includes("failed") || entry.entryType.includes("rejected") ? "bg-red-500/10 text-red-400" :
                  entry.entryType.includes("completed") ? "bg-emerald-500/10 text-emerald-400" :
                  "bg-zinc-500/10 text-zinc-400"
                }`}
              >
                {entry.entryType.includes("approval") ? <Lock className="h-3.5 w-3.5" /> :
                 entry.entryType.includes("completed") ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                 entry.entryType.includes("failed") ? <XCircle className="h-3.5 w-3.5" /> :
                 entry.entryType.includes("llm") ? <Zap className="h-3.5 w-3.5" /> :
                 <FileText className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-200">
                  <span className="font-medium">{entry.actorName}</span>{" "}
                  <span className="text-zinc-400">
                    {entry.entryType.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-xs text-zinc-500">
                  {entry.payload.employee || entry.payload.tool || entry.payload.title || entry.targetType}
                </div>
              </div>
              <span className="shrink-0 text-xs text-zinc-500">
                {formatRelativeTime(entry.createdAt)}
              </span>
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
          <button
            onClick={() => navigate("billing")}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700"
          >
            Manage plan
          </button>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-zinc-400">{formatNumber(DASHBOARD_STATS.tokens.usedThisMonth)} / 10M tokens</span>
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

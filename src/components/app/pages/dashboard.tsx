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
  EmptyState,
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
  IndianRupee,
  Clock,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Users,
  Mail,
  Bot as BotIcon,
  Activity,
} from "lucide-react";

function formatINRfinance(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)} L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

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

  // ─── Onboarding CTA ───────────────────────────────────────────────────────
  // If the workspace has no employees, show the onboarding call-to-action
  // instead of the empty dashboard.
  if (data.needsOnboarding) {
    return (
      <div>
        <PageHeader
          title="Welcome to BIHARI AI"
          description="Hire your first AI Employee to get started"
        />
        <EmptyState
          icon={Bot}
          title="No AI Employees yet"
          description="Your workspace is ready. Hire a Finance Employee to start processing overdue invoices, generating reminders, and recovering payments — all under your approval."
          action={
            <button
              onClick={() => navigate("onboarding")}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              <Sparkles className="h-4 w-4" />
              Start Onboarding
            </button>
          }
        />
      </div>
    );
  }

  // ─── Business Impact KPIs ────────────────────────────────────────────────
  const impact = data.businessImpact || {
    moneyPending: 0,
    moneyRecovered: 0,
    invoicesProcessed: 0,
    customersContacted: 0,
    hoursSaved: 0,
    emailsSent: 0,
    tasksAutomated: 0,
    automationRate: 0,
    humanApprovalRate: 0,
    avgTrustScore: 0,
  };

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

      {/* ─── Business Impact KPIs (MVP-001) ─── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Money Pending"
          value={formatINRfinance(impact.moneyPending)}
          icon={IndianRupee}
          trend={impact.moneyPending > 0 ? "flat" : undefined}
          trendValue={impact.moneyPending > 0 ? "outstanding" : undefined}
          accent="emerald"
        />
        <StatCard
          label="Invoices Processed"
          value={String(impact.invoicesProcessed)}
          icon={FileText}
          trend="up"
          trendValue={`${data.finance?.totalInvoices || 0} total`}
          accent="violet"
        />
        <StatCard
          label="Customers Contacted"
          value={String(impact.customersContacted)}
          icon={Users}
          trend="up"
          trendValue={`${impact.emailsSent} emails sent`}
          accent="sky"
        />
        <StatCard
          label="Hours Saved"
          value={`${impact.hoursSaved.toFixed(1)}h`}
          icon={Clock}
          trend="up"
          trendValue={`${impact.tasksAutomated} tasks automated`}
          accent="emerald"
        />
      </div>

      {/* ─── Automation & Trust KPIs ─── */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Automation Rate"
          value={`${(impact.automationRate * 100).toFixed(0)}%`}
          icon={Zap}
          trend={impact.automationRate >= 0.8 ? "up" : "flat"}
          trendValue={`${data.tasks.completed} completed`}
          accent="emerald"
        />
        <StatCard
          label="Human Approval Rate"
          value={`${(impact.humanApprovalRate * 100).toFixed(0)}%`}
          icon={ShieldCheck}
          trend={impact.humanApprovalRate >= 0.8 ? "up" : "flat"}
          trendValue={`${data.approvals.pending} pending`}
          accent="amber"
        />
        <StatCard
          label="Avg Trust Score"
          value={impact.avgTrustScore.toFixed(1)}
          icon={Scale}
          trend={impact.avgTrustScore >= 80 ? "up" : "flat"}
          trendValue="/ 100"
          accent="emerald"
        />
        <StatCard
          label="Money Recovered"
          value={formatINRfinance(impact.moneyRecovered)}
          icon={TrendingUp}
          trend={impact.moneyRecovered > 0 ? "up" : "flat"}
          trendValue={impact.moneyRecovered > 0 ? "recovered" : "pending"}
          accent="emerald"
        />
      </div>

      {/* Finance metrics (live data) */}
      {data.finance && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <button onClick={() => navigate("finance")} className="text-left">
            <StatCard label="Outstanding AR" value={formatINRfinance(data.finance.outstandingReceivables)} icon={IndianRupee} accent="emerald" />
          </button>
          <button onClick={() => navigate("finance")} className="text-left">
            <StatCard label="Overdue Invoices" value={String(data.finance.overdueCount)} icon={Clock} accent="amber" />
          </button>
          <button onClick={() => navigate("finance")} className="text-left">
            <StatCard label="Recovered This Week" value={formatINRfinance(data.finance.recoveredThisWeek)} icon={CheckCircle2} accent="emerald" />
          </button>
          <button onClick={() => navigate("finance")} className="text-left">
            <StatCard label="Customers at Risk" value={String(data.finance.customersAtRisk)} icon={AlertTriangle} accent="violet" />
          </button>
        </div>
      )}

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
          {barData.length > 0 ? (
            <BarChart data={barData} color="#10b981" height={160} />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-zinc-500">
              No task activity yet
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Token Usage</h3>
          <p className="text-xs text-zinc-500">By employee — this month</p>
          <div className="mt-5 flex justify-center">
            {data.tokens.byEmployee.length > 0 ? (
              <DonutChart data={data.tokens.byEmployee} />
            ) : (
              <div className="flex h-32 items-center justify-center text-xs text-zinc-500">
                No token usage yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Employee Status (business metrics first, not XP) ─── */}
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Bot className="h-4 w-4 text-emerald-400" />
            Employee Status
          </h3>
          <button onClick={() => navigate("employees")} className="text-xs text-emerald-400 hover:text-emerald-300">View all →</button>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {activeEmployees.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Bot className="mx-auto h-8 w-8 text-zinc-700" />
              <p className="mt-2 text-sm font-medium text-zinc-300">No active employees</p>
              <p className="text-xs text-zinc-500">Hire your first AI Employee to get started.</p>
              <button
                onClick={() => navigate("onboarding")}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 mx-auto"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Hire Employee
              </button>
            </div>
          ) : (
            activeEmployees.map((e: any) => (
              <button
                key={e.id}
                onClick={() => navigate(`employees/${e.id}`)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-zinc-800/30"
              >
                <Avatar name={e.name} color={e.avatarColor} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-100">{e.name}</span>
                    <EmployeeStatusBadge status={e.status} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                    <span>{e.roleName}</span>
                    {e.currentTaskTitle ? (
                      <>
                        <span>·</span>
                        <span className="truncate text-emerald-400">{e.currentTaskTitle}</span>
                      </>
                    ) : (
                      <EmployeeStateBadge state={e.state} />
                    )}
                  </div>
                </div>
                {/* Business metrics — not XP */}
                <div className="hidden items-center gap-4 sm:flex">
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Trust</div>
                    <div className={`text-sm font-bold ${e.trustScore >= 80 ? "text-emerald-400" : e.trustScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                      {e.trustScore.toFixed(0)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Automated</div>
                    <div className="text-sm font-bold text-zinc-200">{e.tasksAutomated}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Recovered</div>
                    <div className="text-sm font-bold text-emerald-400">{formatINRfinance(e.moneyRecovered)}</div>
                  </div>
                </div>
                {e.pendingApprovals > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-medium text-amber-400">
                    {e.pendingApprovals} pending
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Two-column: approvals + recent activity */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Pending Approvals */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-zinc-100">Pending Approvals</h3>
            <button onClick={() => navigate("approvals")} className="text-xs text-emerald-400 hover:text-emerald-300">View all →</button>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {pendingApprovals.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/50" />
                <p className="mt-2 text-sm font-medium text-zinc-300">No pending approvals</p>
                <p className="text-xs text-zinc-500">Your AI Employees are working autonomously.</p>
              </div>
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

        {/* Business Activity Feed */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-zinc-100">Recent Activity</h3>
            <button onClick={() => navigate("audit")} className="text-xs text-emerald-400 hover:text-emerald-300">Full audit trail →</button>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {(data.businessFeed || recentAudit).length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Activity className="mx-auto h-8 w-8 text-zinc-700" />
                <p className="mt-2 text-sm font-medium text-zinc-300">No activity yet</p>
                <p className="text-xs text-zinc-500">Activity will appear here as your AI Employees work.</p>
              </div>
            ) : (
              (data.businessFeed || recentAudit).map((entry: any) => (
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
              ))
            )}
          </div>
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

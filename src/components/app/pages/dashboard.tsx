"use client";

import { useRouter, formatRelativeTime, formatNumber, formatINR, formatDateTime } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/app/router";
import { formatINRfinance } from "@/lib/app/data";
import {
  Avatar,
  EmployeeStatusBadge,
  EmployeeStateBadge,
  ErrorState,
  PageSkeleton,
  SeverityDot,
  CategoryBadge,
  EmptyState,
  TrustScoreBadge,
  ConfidenceBar,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  Bot,
  ShieldCheck,
  Lock,
  ArrowRight,
  IndianRupee,
  Clock,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Users,
  Mail,
  CheckCircle2,
  Zap,
  Scale,
  FileText,
  AlertCircle,
  Play,
  Upload,
  ChevronRight,
  Sun,
  Activity,
  Trophy,
  Lightbulb,
  XCircle,
  Loader2,
  Send,
  Scroll,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────


function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ─── Compose existing APIs (no duplicate queries) ─────────────────────────
  // 1. Dashboard API — businessImpact, employees.list, businessFeed, finance
  const { data: dash, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard.get(),
  });

  // 2. Pending Approvals API — rich data (contract + capability + profile)
  const { data: pending = [] } = useQuery({
    queryKey: ["approvals", "pending"],
    queryFn: () => api.approvals.pending(),
    refetchInterval: 15000,
  });

  // 3. Finance Metrics API — aging buckets, avgCollectionTime, escalatedCases
  const { data: finance } = useQuery({
    queryKey: ["finance", "metrics"],
    queryFn: () => api.finance.metrics(),
  });

  // 4. Audit API — richer than dashboard.businessFeed (includes hashes, decisions)
  const { data: auditEntries = [] } = useQuery({
    queryKey: ["audit", "ops-center"],
    queryFn: () => api.audit.list({ limit: 20 }),
  });

  // 4b. Mandates — the fundamental primitive. Shown front-and-center.
  const { data: mandates = [] } = useQuery({
    queryKey: ["mandates", "dashboard"],
    queryFn: () => api.mandates.list(),
    refetchInterval: 15000,
  });

  // 5. Learning data for the first active employee (patterns for insights)
  const firstEmployeeId = dash?.employees?.list?.[0]?.id;
  const { data: patterns = [] } = useQuery({
    queryKey: ["employee", firstEmployeeId, "patterns"],
    queryFn: () => api.employees.patterns(firstEmployeeId!, 10),
    enabled: !!firstEmployeeId,
  });

  // ─── Inline approval mutations (compose Decision Center) ──────────────────
  const approveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.approvals.approve(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.approvals.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  // ─── Loading / error states ───────────────────────────────────────────────
  if (isLoading) return <PageSkeleton variant="dashboard" />;
  if (isError || !dash) return <ErrorState message="Failed to load Operations Center" cause="The server may be unreachable or your session may have expired." action="Try refreshing the page. If the problem persists, sign in again." onRetry={() => refetch()} />;

  // ─── Onboarding CTA ───────────────────────────────────────────────────────
  if (dash.needsOnboarding) {
    return (
      <div>
        <PageHeader title="Welcome to OWNARA" description="Hire your first AI Employee to get started" />
        <EmptyState
          icon={Bot}
          title="No AI Employees yet"
          description="Your workspace is ready. Hire a Finance Employee to start processing overdue invoices, generating reminders, and recovering payments — all under your approval."
          action={
            <button onClick={() => navigate("onboarding")} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
              <Sparkles className="h-4 w-4" /> Start Onboarding
            </button>
          }
        />
      </div>
    );
  }

  const impact = dash.businessImpact || {};
  const employees = dash.employees.list || [];
  const feed = auditEntries.length > 0 ? auditEntries : (dash.businessFeed || dash.recentActivity || []);

  // ─── Compute "overnight" activity (last 12 hours) ─────────────────────────
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const overnightEntries = feed.filter((e: any) => new Date(e.createdAt) >= twelveHoursAgo);
  const overnightActions = overnightEntries.length;
  const overnightReminders = overnightEntries.filter((e: any) =>
    e.entryType?.includes("reminder") || e.businessEvent?.includes("Reminder")
  ).length;
  const overnightEscalations = overnightEntries.filter((e: any) =>
    e.entryType?.includes("escalat") || e.businessEvent?.includes("Escalat")
  ).length;

  // ─── Risks computation ────────────────────────────────────────────────────
  const risks: Array<{ severity: "critical" | "warning" | "info"; title: string; description: string; action?: { label: string; path: string } }> = [];

  if (pending.length > 0) {
    risks.push({
      severity: "warning",
      title: `${pending.length} approval${pending.length > 1 ? "s" : ""} pending`,
      description: "AI Employees are paused until you review.",
      action: { label: "Review", path: "approvals" },
    });
  }
  if (dash.tasks.failed > 0) {
    risks.push({
      severity: "critical",
      title: `${dash.tasks.failed} failed automation${dash.tasks.failed > 1 ? "s" : ""}`,
      description: "Tasks failed and need investigation.",
      action: { label: "Investigate", path: "tasks" },
    });
  }
  if (finance?.overdueCount > 0) {
    risks.push({
      severity: "warning",
      title: `${finance.overdueCount} overdue invoice${finance.overdueCount > 1 ? "s" : ""}`,
      description: `${formatINRfinance(finance.totalOverdue)} outstanding across ${finance.overdueCount} invoices.`,
      action: { label: "View", path: "finance" },
    });
  }
  if (finance?.escalatedCases > 0) {
    risks.push({
      severity: "critical",
      title: `${finance.escalatedCases} escalated case${finance.escalatedCases > 1 ? "s" : ""}`,
      description: "Collection cases have been escalated.",
      action: { label: "Review", path: "finance" },
    });
  }
  if (finance?.customersAtRisk > 0) {
    risks.push({
      severity: "warning",
      title: `${finance.customersAtRisk} customer${finance.customersAtRisk > 1 ? "s" : ""} at risk`,
      description: "High-risk customers with overdue invoices.",
      action: { label: "View", path: "finance" },
    });
  }

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: MORNING BRIEF
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-400">
              <Sun className="h-3.5 w-3.5" />
              Morning Brief
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50">
              {greeting()}, {user?.name?.split(" ")[0] || "there"}.
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Your AI Workforce {overnightActions > 0 ? "completed" : "is ready"}:
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              {overnightActions > 0 && (
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-semibold text-zinc-100">{overnightActions}</span> actions
                </span>
              )}
              {impact.moneyRecovered > 0 && (
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <IndianRupee className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-semibold text-emerald-400">{formatINRfinance(impact.moneyRecovered)}</span> recovered
                </span>
              )}
              {impact.emailsSent > 0 && (
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <Mail className="h-3.5 w-3.5 text-sky-400" />
                  <span className="font-semibold text-zinc-100">{impact.emailsSent}</span> reminders sent
                </span>
              )}
              {overnightEscalations > 0 && (
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-semibold text-amber-400">{overnightEscalations}</span> escalated
                </span>
              )}
              {pending.length > 0 && (
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-semibold text-amber-400">{pending.length}</span> approval{pending.length > 1 ? "s" : ""} waiting
                </span>
              )}
              {overnightActions === 0 && pending.length === 0 && (
                <span className="text-zinc-500">No overnight activity — your workforce is idle and ready.</span>
              )}
            </div>
          </div>
          {/* Quick action: primary CTA */}
          {pending.length > 0 ? (
            <button
              onClick={() => navigate("approvals")}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-400"
            >
              <ShieldCheck className="h-4 w-4" />
              Review {pending.length}
            </button>
          ) : (
            <button
              onClick={() => navigate("finance")}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
            >
              <IndianRupee className="h-4 w-4" />
              View Receivables
            </button>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1b: MANDATES — the living responsibilities entrusted to AI
          ═══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Active Mandates"
          subtitle="Persistent responsibilities your AI workforce pursues continuously"
          action={{ label: "Grant Mandate", path: "grant-mandate" }}
          navigate={navigate}
        />
        {mandates.length === 0 ? (
          <EmptyState
            icon={Scroll}
            title="No Mandates yet"
            description="A Mandate is a persistent organizational responsibility you entrust to an AI employee. Unlike a task, it pursues a desired state continuously."
            action={
              <button onClick={() => navigate("grant-mandate")} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
                Grant your first Mandate
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {mandates.map((m: any) => (
              <button
                key={m.id}
                onClick={() => navigate(`mandates/${m.id}`)}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Scroll className="h-4 w-4 shrink-0 text-emerald-400" />
                      <h3 className="truncate text-sm font-semibold text-zinc-50">{m.title}</h3>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{m.declaration}</p>
                  </div>
                  <span className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold",
                    m.status === "active" ? "bg-emerald-500/15 text-emerald-400" :
                    m.status === "paused" ? "bg-amber-500/15 text-amber-400" :
                    "bg-zinc-500/15 text-zinc-400"
                  )}>
                    {m.status === "active" && <Activity className="h-2.5 w-2.5" />}
                    {m.status}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Desired-state health</span>
                    <span className={cn("font-bold", m.healthScore >= 80 ? "text-emerald-400" : m.healthScore >= 50 ? "text-amber-400" : "text-red-400")}>
                      {Math.round(m.healthScore)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={cn("h-full rounded-full", m.healthScore >= 80 ? "bg-emerald-500" : m.healthScore >= 50 ? "bg-amber-500" : "bg-red-500")}
                      style={{ width: `${m.healthScore}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 text-[0.65rem] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    {m.tenant?.name || "Unassigned"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    {m._count?.tasks || 0} episodes
                  </span>
                  <span className="ml-auto flex items-center gap-0.5 text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100">
                    View <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2: KAVYA TODAY — what your Finance Employee is doing
          ═══════════════════════════════════════════════════════════════════════ */}
      <KavyaToday
        employees={employees}
        pending={pending}
        impact={impact}
        finance={finance}
        feed={feed}
        navigate={navigate}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: AI WORKFORCE
          ═══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader title="AI Workforce" subtitle={`${employees.length} active employee${employees.length !== 1 ? "s" : ""}`} />
        {employees.length === 0 ? (
          <EmptyState icon={Bot} title="No active employees" description="Hire your first AI Employee to get started." action={<button onClick={() => navigate("onboarding")} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">Start Onboarding</button>} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {employees.map((e: any) => (
              <WorkforceCard key={e.id} employee={e} navigate={navigate} />
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: DECISION CENTER PREVIEW (inline approvals)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          title="Decision Center"
          subtitle={pending.length > 0 ? `${pending.length} waiting` : "all clear"}
          action={pending.length > 0 ? { label: "View all", path: "approvals" } : undefined}
          navigate={navigate}
        />
        {pending.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/50" />
            <p className="mt-2 text-center text-sm font-medium text-zinc-300">No approvals pending</p>
            <p className="text-center text-xs text-zinc-500">Your AI Employees are working autonomously.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.slice(0, 3).map((a: any) => (
              <ApprovalPreviewCard
                key={a.id}
                approval={a}
                onApprove={() => approveMutation.mutate({ id: a.id, reason: "Approved" })}
                onReject={() => rejectMutation.mutate({ id: a.id, reason: "Rejected" })}
                onView={() => navigate("approvals")}
                approving={approveMutation.isPending}
                rejecting={rejectMutation.isPending}
              />
            ))}
            {pending.length > 3 && (
              <button onClick={() => navigate("approvals")} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-800 py-2.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
                View {pending.length - 3} more approval{pending.length - 3 > 1 ? "s" : ""}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5: BUSINESS TIMELINE
          ═══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader title="Business Timeline" subtitle="last 24 hours" action={{ label: "Full audit trail", path: "audit" }} navigate={navigate} />
        {feed.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center text-xs text-zinc-500">
            No activity yet. Your AI Employees will appear here as they work.
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <div className="max-h-80 overflow-y-auto">
              {feed.slice(0, 15).map((entry: any, idx: number) => (
                <div key={entry.id || idx} className="flex items-start gap-3 border-b border-zinc-800/50 px-4 py-3 last:border-0">
                  <div className="w-16 shrink-0 text-right">
                    <div className="font-mono text-[0.65rem] text-zinc-500">{formatTime(entry.createdAt)}</div>
                  </div>
                  <SeverityDot severity={entry.severity || "info"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">{entry.businessEvent || entry.entryType?.replace(/_/g, " ")}</span>
                      <CategoryBadge category={entry.category || "system"} />
                    </div>
                    <div className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      {entry.businessDescription || `${entry.actorName} performed an action`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 6: RISKS
          ═══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader title="Risks" subtitle={risks.length > 0 ? `${risks.length} identified` : "none identified"} />
        {risks.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-2 text-sm font-medium text-zinc-300">No risks identified</p>
            <p className="text-xs text-zinc-500">All systems are operating within normal parameters.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {risks.map((r, idx) => (
              <div key={idx} className={cn(
                "flex items-start gap-3 rounded-xl border p-4",
                r.severity === "critical" ? "border-red-500/20 bg-red-500/5" :
                r.severity === "warning" ? "border-amber-500/20 bg-amber-500/5" :
                "border-zinc-800 bg-zinc-900/50"
              )}>
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  r.severity === "critical" ? "bg-red-500/15 text-red-400" :
                  r.severity === "warning" ? "bg-amber-500/15 text-amber-400" :
                  "bg-zinc-800 text-zinc-400"
                )}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-100">{r.title}</div>
                  <div className="text-xs text-zinc-400">{r.description}</div>
                </div>
                {r.action && (
                  <button
                    onClick={() => navigate(r.action!.path)}
                    className="shrink-0 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                  >
                    {r.action.label}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 7: BUSINESS INSIGHTS (from Learning Engine)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader title="Business Insights" subtitle="learned from outcomes" />
        {patterns.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center">
            <Lightbulb className="mx-auto h-8 w-8 text-zinc-700" />
            <p className="mt-2 text-sm font-medium text-zinc-300">No insights yet</p>
            <p className="text-xs text-zinc-500">Insights emerge as your AI Employees process more tasks with measurable outcomes.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {patterns.slice(0, 4).map((p: any) => (
              <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-sky-400" />
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[0.6rem] font-medium text-sky-400">
                    {p.patternType?.replace(/_/g, " ")}
                  </span>
                  <span className="ml-auto text-[0.6rem] text-zinc-500">{(p.confidence * 100).toFixed(0)}% confidence</span>
                </div>
                <p className="mt-2 text-sm text-zinc-200">{p.description}</p>
                <div className="mt-2 text-[0.65rem] text-zinc-500">
                  Observed {p.observationCount}× · {p.entityLabel}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 8: QUICK ACTIONS
          ═══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader title="Quick Actions" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <QuickAction icon={Send} label="Delegate Work" description="Assign work to Kavya" onClick={() => navigate("delegate")} primary />
          <QuickAction icon={ShieldCheck} label="Review Decisions" description={`${pending.length} pending`} onClick={() => navigate("approvals")} disabled={pending.length === 0} />
          <QuickAction icon={IndianRupee} label="View Receivables" description="AR aging & invoices" onClick={() => navigate("finance")} />
          <QuickAction icon={Upload} label="Upload Invoices" description="Import CSV data" onClick={() => navigate("onboarding")} />
          <QuickAction icon={Activity} label="View Tasks" description={`${dash.tasks.inProgress + dash.tasks.waitingApproval} active`} onClick={() => navigate("tasks")} />
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold tracking-tight text-zinc-50">{title}</h1>
      {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
    </div>
  );
}

// ─── Kavya Today ─────────────────────────────────────────────────────────────

function KavyaToday({
  employees,
  pending,
  impact,
  finance,
  feed,
  navigate,
}: {
  employees: any[];
  pending: any[];
  impact: any;
  finance: any;
  feed: any[];
  navigate: (path: string) => void;
}) {
  const kavya = employees.find((e: any) => e.role === "finance_employee") || employees[0];
  if (!kavya) return null;

  const todayFeed = feed.filter((e: any) => {
    const d = new Date(e.createdAt);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const completedToday = todayFeed.filter((e: any) =>
    e.entryType?.includes("completed") || e.entryType?.includes("sent") || e.entryType?.includes("approved")
  );

  const isWorking = kavya.state === "executing" || kavya.state === "planning";
  const isWaiting = pending.length > 0;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={kavya.name} color={kavya.avatarColor} size="md" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{kavya.name} Today</h2>
            <p className="text-[0.65rem] text-zinc-500">Finance Employee · {kavya.title}</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`employees/${kavya.id}`)}
          className="text-xs text-emerald-400 hover:text-emerald-300"
        >
          View profile →
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Working on */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
            {isWorking ? (
              <><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span> Working on</>
            ) : (
              <><Activity className="h-3 w-3" /> Current status</>
            )}
          </div>
          <div className="mt-1.5 text-sm font-medium text-zinc-200">
            {kavya.currentTaskTitle || "Available for new work"}
          </div>
          {kavya.currentTaskTitle && (
            <div className="mt-0.5 text-[0.65rem] text-emerald-400">In progress</div>
          )}
        </div>

        {/* Completed Today */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
            <CheckCircle2 className="h-3 w-3" /> Completed Today
          </div>
          <div className="mt-1.5 text-sm font-medium text-zinc-200">
            {completedToday.length > 0
              ? `${completedToday.length} action${completedToday.length > 1 ? "s" : ""}`
              : "No finance tasks completed today"}
          </div>
          <div className="mt-0.5 text-[0.65rem] text-zinc-500">
            {impact.emailsSent > 0 ? `${impact.emailsSent} reminders sent` : "Ready to start"}
          </div>
        </div>

        {/* Waiting for Your Approval */}
        <div
          className={cn(
            "cursor-pointer rounded-lg border p-3 transition-colors",
            isWaiting ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10" : "border-zinc-800 bg-zinc-900/50"
          )}
          onClick={() => isWaiting && navigate("approvals")}
        >
          <div className="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
            <Lock className="h-3 w-3" /> Waiting for Approval
          </div>
          <div className="mt-1.5 text-sm font-medium text-zinc-200">
            {isWaiting ? `${pending.length} decision${pending.length > 1 ? "s" : ""} pending` : "Nothing waiting"}
          </div>
          <div className="mt-0.5 text-[0.65rem] text-zinc-500">
            {isWaiting ? "Click to review" : "All clear"}
          </div>
        </div>

        {/* Estimated Recovery */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
            <IndianRupee className="h-3 w-3" /> Estimated Recovery
          </div>
          <div className="mt-1.5 text-sm font-bold text-emerald-400">
            {finance?.totalOverdue ? formatINRfinance(finance.totalOverdue) : "—"}
          </div>
          <div className="mt-0.5 text-[0.65rem] text-zinc-500">
            {finance?.overdueCount ? `${finance.overdueCount} overdue invoices` : "No overdue invoices"}
          </div>
        </div>
      </div>

      {/* Recent Decisions / Activity strip */}
      {todayFeed.length > 0 && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <div className="mb-2 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">Recent Activity</div>
          <div className="flex flex-wrap gap-2">
            {todayFeed.slice(0, 4).map((entry: any, idx: number) => (
              <span key={entry.id || idx} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 text-[0.65rem] text-zinc-400">
                <SeverityDot severity={entry.severity || "info"} />
                <span className="truncate max-w-[180px]">
                  {entry.businessEvent || entry.entryType?.replace(/_/g, " ")}
                </span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-600">{formatRelativeTime(entry.createdAt)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
  navigate,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; path: string };
  navigate?: (path: string) => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
      </div>
      {action && navigate && (
        <button onClick={() => navigate(action.path)} className="text-xs text-emerald-400 hover:text-emerald-300">
          {action.label} →
        </button>
      )}
    </div>
  );
}

function SnapCell({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  accent: "emerald" | "amber" | "violet" | "sky" | "red";
}) {
  const colorMap = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    violet: "text-violet-400",
    sky: "text-sky-400",
    red: "text-red-400",
  };
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[0.6rem] uppercase tracking-wider text-zinc-500">{label}</span>
        <Icon className={cn("h-3.5 w-3.5", colorMap[accent])} />
      </div>
      <div className={cn("mt-1.5 text-lg font-bold", colorMap[accent])}>{value}</div>
      {sub && <div className="text-[0.6rem] text-zinc-500">{sub}</div>}
    </div>
  );
}

function WorkforceCard({ employee: e, navigate }: { employee: any; navigate: (path: string) => void }) {
  return (
    <button
      onClick={() => navigate(`employees/${e.id}`)}
      className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar name={e.name} color={e.avatarColor} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-zinc-100">{e.name}</h3>
            <EmployeeStatusBadge status={e.status} />
          </div>
          <p className="truncate text-xs text-zinc-500">{e.roleName}</p>
          <div className="mt-1 flex items-center gap-1.5">
            {e.currentTaskTitle ? (
              <span className="truncate text-[0.7rem] text-emerald-400">● {e.currentTaskTitle}</span>
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

      {/* Business metrics grid */}
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-zinc-800 pt-3">
        <MetricCell label="Trust" value={e.trustScore?.toFixed(0) || "—"} color={e.trustScore >= 80 ? "text-emerald-400" : e.trustScore >= 60 ? "text-amber-400" : "text-red-400"} />
        <MetricCell label="Level" value={`Lv${e.level || 1}`} color="text-zinc-200" />
        <MetricCell label="Automated" value={String(e.tasksAutomated || 0)} color="text-zinc-200" />
        <MetricCell label="Recovered" value={e.moneyRecovered > 0 ? formatINRfinance(e.moneyRecovered) : "—"} color="text-emerald-400" />
      </div>

      {/* Today's work summary */}
      <div className="mt-3 flex items-center justify-between text-[0.65rem] text-zinc-500">
        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {e.emailsSent || 0} emails</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {e.hoursSaved?.toFixed(1) || 0}h saved</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {((e.approvalRate || 1) * 100).toFixed(0)}% approved</span>
      </div>

      {/* Latest achievement hint */}
      <div className="mt-3 flex items-center gap-1.5 border-t border-zinc-800 pt-2 text-[0.65rem] text-zinc-500">
        <Trophy className="h-3 w-3 text-amber-400/70" />
        <span>{e.title || "Intern"} · {e.completedTasks || 0} tasks completed</span>
        <ChevronRight className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </button>
  );
}

function MetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-[0.55rem] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={cn("mt-0.5 text-sm font-bold", color)}>{value}</div>
    </div>
  );
}

function ApprovalPreviewCard({
  approval: a,
  onApprove,
  onReject,
  onView,
  approving,
  rejecting,
}: {
  approval: any;
  onApprove: () => void;
  onReject: () => void;
  onView: () => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const proposed = a.proposedAction || {};
  const confidencePct = a.confidence ? Math.round(a.confidence * 100) : null;
  const confidenceColor = confidencePct && confidencePct >= 85 ? "text-emerald-400" : confidencePct && confidencePct >= 70 ? "text-amber-400" : "text-red-400";
  const trustScore = a.profile?.trustScore;
  const trustLabel = trustScore >= 80 ? "Trusted by your organization" : trustScore >= 60 ? "Building trust" : "New employee";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      {/* Header — Employee + Trust */}
      <div className="flex items-start gap-3">
        <Avatar name={a.employeeName} color={a.employeeColor} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">{a.employeeName}</span>
            <span className="text-[0.6rem] text-zinc-500">recommends</span>
          </div>
          <div className="text-xs text-zinc-500">{a.toolDisplayName}</div>
          {trustScore && (
            <div className="mt-0.5 text-[0.6rem] text-emerald-400/70">{trustLabel}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">{formatRelativeTime(a.createdAt)}</div>
        </div>
      </div>

      {/* Why this recommendation */}
      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
          Why this recommendation?
        </div>
        {(proposed.subject || proposed.body) && (
          <div className="space-y-1">
            {proposed.to && <div className="text-xs text-zinc-500">To: <span className="text-zinc-300">{proposed.to}</span></div>}
            {proposed.subject && <div className="text-xs text-zinc-500">Subject: <span className="text-zinc-300">{proposed.subject}</span></div>}
            {proposed.body && <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{proposed.body}</p>}
          </div>
        )}
      </div>

      {/* Decision grid: Business Impact | Confidence | Risk | Data Used */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {a.businessImpact && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
            <div className="text-[0.55rem] font-semibold uppercase tracking-wider text-zinc-500">Business Impact</div>
            <div className="mt-0.5 text-[0.7rem] text-zinc-300">{a.businessImpact}</div>
          </div>
        )}
        {confidencePct !== null && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
            <div className="text-[0.55rem] font-semibold uppercase tracking-wider text-zinc-500">Confidence</div>
            <div className={cn("mt-0.5 text-[0.7rem] font-bold", confidenceColor)}>{confidencePct}%</div>
          </div>
        )}
        {a.riskScore !== undefined && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
            <div className="text-[0.55rem] font-semibold uppercase tracking-wider text-zinc-500">Risk</div>
            <div className={cn("mt-0.5 text-[0.7rem] font-bold", a.riskScore >= 70 ? "text-red-400" : a.riskScore >= 40 ? "text-amber-400" : "text-emerald-400")}>
              {a.riskScore >= 70 ? "High" : a.riskScore >= 40 ? "Medium" : "Low"}
            </div>
          </div>
        )}
        {a.policyTrigger && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
            <div className="text-[0.55rem] font-semibold uppercase tracking-wider text-zinc-500">Policy</div>
            <div className="mt-0.5 text-[0.7rem] text-zinc-300">{a.policyTrigger}</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onApprove}
          disabled={approving || rejecting}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
        >
          {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Approve
        </button>
        <button
          onClick={onReject}
          disabled={approving || rejecting}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Reject
        </button>
        <button
          onClick={onView}
          className="flex items-center justify-center rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          Details
        </button>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
  primary,
}: {
  icon: any;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all disabled:opacity-40 disabled:hover:border-zinc-800 disabled:hover:bg-zinc-900/50",
        primary
          ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60 hover:bg-emerald-500/10"
          : "border-zinc-800 bg-zinc-900/50 hover:border-emerald-500/40 hover:bg-zinc-900"
      )}
    >
      <div className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
        primary
          ? "bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30"
          : "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20"
      )}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <div className="text-sm font-medium text-zinc-100">{label}</div>
        <div className="text-xs text-zinc-500">{description}</div>
      </div>
    </button>
  );
}

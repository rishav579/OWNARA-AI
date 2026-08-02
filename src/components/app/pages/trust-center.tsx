"use client";

import { useState } from "react";
import { useRouter, formatRelativeTime, formatDateTime, formatDate, formatNumber, formatINR } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery } from "@tanstack/react-query";
import { formatINRfinance } from "@/lib/app/data";
import {
  Avatar,
  EmployeeStatusBadge,
  EmployeeStateBadge,
  TrustScoreBadge,
  ConfidenceBar,
  EmptyState,
  ErrorState,
  PageSkeleton,
  SeverityDot,
  CategoryBadge,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  Shield,
  ShieldCheck,
  Award,
  TrendingUp,
  AlertTriangle,
  FileText,
  Printer,
  Download,
  Bot,
  Brain,
  Lock,
  Scale,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Users,
  Building2,
  Key,
  Database,
  Eye,
  ChevronRight,
  Sparkles,
  Trophy,
  AlertOctagon,
  Zap,
  IndianRupee,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────


// ─── Main Page ───────────────────────────────────────────────────────────────

const MODULES = [
  { id: "ceo-report", label: "CEO Report", icon: Building2 },
  { id: "customer-report", label: "Customer Report", icon: ShieldCheck },
  { id: "risk", label: "Risk Center", icon: AlertOctagon },
  { id: "security", label: "Security", icon: Lock },
] as const;

export function TrustCenterPage() {
  const [module, setModule] = useState<(typeof MODULES)[number]["id"]>("ceo-report");

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-50">Trust Center</h1>
            <p className="text-xs text-zinc-500">Enterprise trust, explainability, and governance</p>
          </div>
        </div>
      </div>

      {/* Module selector */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => setModule(m.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors",
                module === m.id
                  ? "border-emerald-500 bg-emerald-500/5 text-emerald-400"
                  : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[0.6rem] font-medium leading-tight">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Module content */}
      {module === "risk" && <RiskCenterModule />}
      {module === "ceo-report" && <CEOReportModule />}
      {module === "customer-report" && <CustomerTrustReportModule />}
      {module === "security" && <SecurityOverviewModule />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODULE 1: Employee Identity Cards
// Composes: api.employees.list + api.employees.profile + api.employees.capabilities
//           + api.employees.achievements + api.employees.businessImpact + api.employees.careerTimeline
// ═════════════════════════════════════════════════════════════════════════════

function IdentityCardsModule() {
  const { navigate } = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", "active"],
    queryFn: () => api.employees.list({ status: "active" }),
  });

  const selectedEmployee = selectedId ? employees.find((e: any) => e.id === selectedId) : employees[0];
  const empId = selectedEmployee?.id;

  // Compose all the data for the identity card
  const { data: profile } = useQuery({
    queryKey: ["employee", empId, "profile"],
    queryFn: () => api.employees.profile(empId!),
    enabled: !!empId,
  });
  const { data: achievements = [] } = useQuery({
    queryKey: ["employee", empId, "achievements"],
    queryFn: () => api.employees.achievements(empId!),
    enabled: !!empId,
  });
  const { data: businessImpact } = useQuery({
    queryKey: ["employee", empId, "business-impact"],
    queryFn: () => api.employees.businessImpact(empId!),
    enabled: !!empId,
  });
  const { data: capabilities = [] } = useQuery({
    queryKey: ["employee", empId, "capabilities"],
    queryFn: () => api.capabilities.listForEmployee(empId!),
    enabled: !!empId,
  });
  const { data: timeline = [] } = useQuery({
    queryKey: ["employee", empId, "career-timeline"],
    queryFn: () => api.employees.careerTimeline(empId!, 5),
    enabled: !!empId,
  });

  if (isLoading) return <PageSkeleton variant="list" />;
  if (employees.length === 0) return <EmptyState icon={Bot} title="No employees" description="Hire your first AI Employee to see identity cards." />;

  const unlockedAchievements = achievements.filter((a: any) => a.unlocked);

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {/* Employee picker */}
      <div className="lg:col-span-1">
        <div className="space-y-1.5">
          {employees.map((e: any) => (
            <button
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                selectedEmployee?.id === e.id ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-800 hover:border-zinc-700"
              )}
            >
              <Avatar name={e.name} color={e.avatarColor} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-zinc-200">{e.name}</div>
                <div className="truncate text-[0.6rem] text-zinc-500">{e.roleName}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Identity Card */}
      <div className="lg:col-span-3">
        {selectedEmployee && profile && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            {/* Card header — enterprise identity */}
            <div className="border-b border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/30 p-5">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <Avatar name={selectedEmployee.name} color={selectedEmployee.avatarColor} size="lg" />
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-zinc-900 bg-emerald-500">
                    <CheckCircle2 className="h-3 w-3 text-emerald-950" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-zinc-50">{selectedEmployee.name}</h2>
                    <EmployeeStatusBadge status={selectedEmployee.status} />
                  </div>
                  <div className="mt-0.5 text-sm text-zinc-400">{selectedEmployee.roleName}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-[0.6rem] text-zinc-400">
                      ID: {selectedEmployee.id.slice(-12).toUpperCase()}
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[0.6rem] text-zinc-400">
                      v{profile.version}
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[0.6rem] text-zinc-400">
                      Lv{profile.level} · {profile.title}
                    </span>
                    {selectedEmployee.currentTaskTitle && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.6rem] text-emerald-400">
                        ● {selectedEmployee.currentTaskTitle}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">Trust Score</div>
                  <div className={cn(
                    "text-2xl font-bold",
                    profile.trustScore >= 80 ? "text-emerald-400" : profile.trustScore >= 60 ? "text-amber-400" : "text-red-400"
                  )}>
                    {profile.trustScore.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>

            {/* Card body — enterprise metrics grid */}
            <div className="grid grid-cols-2 gap-px bg-zinc-800 sm:grid-cols-4">
              <CardMetric label="Experience" value={`${profile.experiencePoints} XP`} sub={`Level ${profile.level}`} />
              <CardMetric label="Tasks Completed" value={String(profile.completedTasks)} sub={`${profile.failedTasks} failed`} />
              <CardMetric label="Hours Saved" value={`${profile.hoursSaved.toFixed(1)}h`} sub="manual work" />
              <CardMetric label="Money Recovered" value={formatINRfinance(profile.moneyRecovered)} sub="realised" highlight={profile.moneyRecovered > 0} />
              <CardMetric label="Approval Rate" value={`${(profile.approvalRate * 100).toFixed(0)}%`} sub="human-approved" />
              <CardMetric label="Accuracy" value={`${(profile.accuracyScore * 100).toFixed(0)}%`} sub="confidence match" />
              <CardMetric label="Memory Count" value={String(profile.memoryCount)} sub={`${profile.reinforcementCount} reinforced`} />
              <CardMetric label="Capabilities" value={String(profile.capabilitiesGranted)} sub={`${profile.criticalCapabilities} critical`} />
            </div>

            {/* Skills + Capabilities + Restrictions */}
            <div className="grid gap-4 p-5 lg:grid-cols-3">
              {/* Skills */}
              <div>
                <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Skills</div>
                <div className="space-y-1.5">
                  {(profile.skills || []).slice(0, 5).map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300">{s.name}</span>
                      <span className="flex items-center gap-1">
                        <span className="font-mono text-[0.6rem] text-zinc-500">L{s.level}</span>
                        <span className="rounded bg-zinc-800 px-1 text-[0.55rem] text-zinc-400">{(s.confidence * 100).toFixed(0)}%</span>
                      </span>
                    </div>
                  ))}
                  {(!profile.skills || profile.skills.length === 0) && <span className="text-[0.65rem] text-zinc-600">No skills tracked yet</span>}
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Capabilities</div>
                <div className="flex flex-wrap gap-1">
                  {capabilities.map((c: any) => (
                    <span key={c.id} className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[0.55rem]",
                      c.capability?.riskLevel === "critical" ? "bg-red-500/10 text-red-400" :
                      c.capability?.riskLevel === "high" ? "bg-amber-500/10 text-amber-400" :
                      "bg-zinc-800 text-zinc-400"
                    )}>
                      {c.capability?.code}
                    </span>
                  ))}
                  {capabilities.length === 0 && <span className="text-[0.65rem] text-zinc-600">No capabilities granted</span>}
                </div>
              </div>

              {/* Restrictions */}
              <div>
                <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Restrictions</div>
                <div className="space-y-1">
                  {(selectedEmployee.boundaries || []).slice(0, 4).map((b: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 text-[0.65rem] text-zinc-400">
                      <Lock className="mt-0.5 h-2.5 w-2.5 shrink-0 text-amber-400" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Achievements + Learning + Business Outcomes */}
            <div className="grid gap-4 border-t border-zinc-800 p-5 lg:grid-cols-3">
              {/* Achievements */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
                  <Trophy className="h-3 w-3 text-amber-400" /> Achievements
                </div>
                <div className="space-y-1">
                  {unlockedAchievements.slice(0, 4).map((a: any) => (
                    <div key={a.id} className="flex items-center gap-1.5 text-xs">
                      <span className="text-amber-400">★</span>
                      <span className="text-zinc-300">{a.name}</span>
                    </div>
                  ))}
                  {unlockedAchievements.length === 0 && <span className="text-[0.65rem] text-zinc-600">No achievements yet</span>}
                </div>
              </div>

              {/* Learning */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
                  <Brain className="h-3 w-3 text-violet-400" /> Learning
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-zinc-400">Patterns</span><span className="text-zinc-200">{businessImpact?.totalOutcomes || 0}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Streak</span><span className="text-zinc-200">{businessImpact?.currentStreak || 0}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Avg Confidence</span><span className="text-zinc-200">{(profile.averageConfidence * 100).toFixed(0)}%</span></div>
                </div>
              </div>

              {/* Business Outcomes */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
                  <TrendingUp className="h-3 w-3 text-emerald-400" /> Business Outcomes
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-zinc-400">Customers</span><span className="text-zinc-200">{profile.customersHandled}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Emails</span><span className="text-zinc-200">{profile.emailsSent}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Invoices</span><span className="text-zinc-200">{profile.invoicesProcessed}</span></div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="border-t border-zinc-800 p-5">
              <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Recent Activity</div>
              <div className="space-y-1.5">
                {timeline.slice(0, 4).map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <div className="h-1 w-1 rounded-full bg-emerald-400" />
                    <span className="text-zinc-300">{t.title}</span>
                    <span className="ml-auto text-[0.6rem] text-zinc-500">{formatRelativeTime(t.createdAt)}</span>
                  </div>
                ))}
                {timeline.length === 0 && <span className="text-[0.65rem] text-zinc-600">No recent activity</span>}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3">
              <span className="text-[0.6rem] text-zinc-600">
                Hired {formatDate(selectedEmployee.createdAt)} · Last task {profile.lastTaskAt ? formatRelativeTime(profile.lastTaskAt) : "—"}
              </span>
              <button
                onClick={() => navigate(`employees/${selectedEmployee.id}`)}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
              >
                View full profile <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODULE 2: Explainability Center
// Composes: api.approvals.pending (contract + evidence + reasoning)
// ═════════════════════════════════════════════════════════════════════════════

function ExplainabilityModule() {
  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["approvals", "pending"],
    queryFn: () => api.approvals.pending(),
  });
  const { data: decided = [] } = useQuery({
    queryKey: ["approvals", "history"],
    queryFn: () => api.approvals.list("all"),
  });

  if (isLoading) return <PageSkeleton variant="list" />;

  const allApprovals = [...pending, ...decided.filter((a: any) => a.status !== "pending").slice(0, 10)];

  if (allApprovals.length === 0) {
    return <EmptyState icon={Eye} title="No explainable decisions yet" description="Approvals with full reasoning will appear here once your AI Employees start working." />;
  }

  return (
    <div className="space-y-3">
      {allApprovals.slice(0, 10).map((a: any) => (
        <ExplainabilityCard key={a.id} approval={a} />
      ))}
    </div>
  );
}

function ExplainabilityCard({ approval: a }: { approval: any }) {
  const contract = a.contract;
  const profile = a.profile;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-zinc-800 pb-3">
        <Avatar name={a.employeeName} color={a.employeeColor} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">{a.toolDisplayName}</h3>
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium",
              a.status === "approved" ? "bg-emerald-500/15 text-emerald-400" :
              a.status === "rejected" ? "bg-red-500/15 text-red-400" :
              a.status === "pending" ? "bg-amber-500/15 text-amber-400" :
              "bg-zinc-800 text-zinc-400"
            )}>
              {a.status}
            </span>
            {contract && (
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.55rem] text-zinc-400">
                {contract.contractNumber} v{contract.version}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">{a.taskTitle}</div>
        </div>
        <div className="text-right">
          <div className="text-[0.6rem] text-zinc-500">Confidence</div>
          <div className="text-sm font-bold text-zinc-200">{((a.confidence || contract?.confidence || 0.85) * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* 9-point explainability grid */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Why */}
        <ExplainCell label="Why" value={contract?.goal || a.businessImpact || "Action recommended based on business rules"} icon={Brain} />
        {/* Evidence */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
            <Database className="h-3 w-3" /> Evidence
          </div>
          <div className="mt-1.5 space-y-1">
            {(contract?.evidence || []).slice(0, 3).map((e: any, i: number) => (
              <div key={i} className="text-[0.65rem] text-zinc-400">
                <span className="font-medium text-zinc-300">{e.source}:</span> {e.fact}
              </div>
            ))}
            {(!contract?.evidence || contract.evidence.length === 0) && <span className="text-[0.65rem] text-zinc-600">No evidence recorded</span>}
          </div>
        </div>
        {/* Business Rule */}
        <ExplainCell label="Business Rule" value={contract?.requiredAuthority || a.policyTrigger || "Standard approval workflow"} icon={Scale} />
        {/* Alternatives */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
            <AlertTriangle className="h-3 w-3" /> Alternatives
          </div>
          <div className="mt-1.5 space-y-1">
            {(contract?.evidence || []).slice(0, 2).map((e: any, i: number) => (
              <div key={i} className="text-[0.65rem] text-zinc-500 line-through">{e.fact}</div>
            ))}
            {(!contract?.evidence || contract.evidence.length === 0) && <span className="text-[0.65rem] text-zinc-600">No alternatives considered</span>}
          </div>
        </div>
        {/* Confidence */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
            <Zap className="h-3 w-3" /> Confidence
          </div>
          <div className="mt-2">
            <ConfidenceBar value={a.confidence || contract?.confidence || 0.85} />
          </div>
        </div>
        {/* Expected Impact */}
        <ExplainCell label="Expected Impact" value={contract?.estimatedBusinessOutcome || a.businessImpact || "Positive business outcome expected"} icon={TrendingUp} />
        {/* Risk */}
        <ExplainCell label="Risk" value={contract?.rollbackPlan || "Low risk — action is reversible"} icon={AlertOctagon} />
        {/* Rollback */}
        <ExplainCell label="Rollback Plan" value={contract?.rollbackPlan || "Action can be reversed manually"} icon={Lock} />
        {/* Human Approval */}
        <ExplainCell label="Human Approval" value={a.status === "pending" ? "Awaiting your decision" : a.status === "approved" ? "Approved by human" : "Rejected by human"} icon={ShieldCheck} />
        {/* Timeline */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
            <Clock className="h-3 w-3" /> Timeline
          </div>
          <div className="mt-1.5 space-y-0.5 text-[0.65rem] text-zinc-400">
            <div>Generated: {contract?.generatedAt ? formatRelativeTime(contract.generatedAt) : "—"}</div>
            <div>Requested: {formatRelativeTime(a.createdAt)}</div>
            {a.decidedAt && <div>Decided: {formatRelativeTime(a.decidedAt)}</div>}
          </div>
        </div>
      </div>

      {/* Employee context */}
      {profile && (
        <div className="mt-3 flex items-center gap-3 border-t border-zinc-800 pt-3 text-xs">
          <span className="text-zinc-500">Employee standing:</span>
          <span className="font-mono text-zinc-400">Lv{profile.level} {profile.title}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-emerald-400">Trust {profile.trustScore.toFixed(0)}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400">{profile.completedTasks} tasks completed</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400">{(profile.approvalRate * 100).toFixed(0)}% approval rate</span>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODULE 3: Trust Timeline
// Composes: api.employees.careerTimeline + api.audit.list + api.approvals.list
// ═════════════════════════════════════════════════════════════════════════════

function TrustTimelineModule() {
  const [employeeId, setEmployeeId] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", "active"],
    queryFn: () => api.employees.list({ status: "active" }),
  });

  const selectedId = employeeId || employees[0]?.id;

  const { data: careerTimeline = [] } = useQuery({
    queryKey: ["employee", selectedId, "career-timeline"],
    queryFn: () => api.employees.careerTimeline(selectedId!, 50),
    enabled: !!selectedId,
  });

  const { data: auditEntries = [] } = useQuery({
    queryKey: ["audit", selectedId],
    queryFn: () => api.audit.list({ limit: 50 }),
    enabled: !!selectedId,
  });

  // Merge career timeline + audit entries into one chronological timeline
  const merged = [
    ...careerTimeline.map((t: any) => ({
      id: t.id,
      type: t.entryType,
      title: t.title,
      description: t.description,
      createdAt: t.createdAt,
      source: "career",
      metadata: t.metadata ? JSON.parse(t.metadata) : {},
      levelAtTime: t.levelAtTime,
      trustAtTime: t.trustAtTime,
    })),
    ...auditEntries
      .filter((a: any) => a.actorId === selectedId || a.targetId === selectedId)
      .map((a: any) => ({
        id: a.id,
        type: a.entryType,
        title: a.businessEvent || a.entryType?.replace(/_/g, " "),
        description: a.businessDescription || `${a.actorName} performed an action`,
        createdAt: a.createdAt,
        source: "audit",
        metadata: a.payload,
        levelAtTime: 0,
        trustAtTime: 0,
      })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = typeFilter === "all" ? merged : merged.filter((e) => e.type.includes(typeFilter));

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="h-8 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-200 outline-none focus:border-emerald-500"
        >
          <option value="">All employees</option>
          {employees.map((e: any) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {["all", "skill", "strength", "weakness", "achievement", "approval", "task", "audit"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[0.6rem] font-medium capitalize transition-colors",
                typeFilter === t ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">No timeline entries</div>
          ) : (
            filtered.map((entry, idx) => (
              <div key={entry.id} className="flex items-start gap-3 border-b border-zinc-800/50 px-4 py-3 last:border-0">
                <div className="w-20 shrink-0 text-right">
                  <div className="font-mono text-[0.6rem] text-zinc-500">{formatRelativeTime(entry.createdAt)}</div>
                  <div className={cn(
                    "mt-0.5 rounded px-1 text-[0.5rem] font-medium",
                    entry.source === "career" ? "bg-violet-500/10 text-violet-400" : "bg-zinc-800 text-zinc-500"
                  )}>
                    {entry.source}
                  </div>
                </div>
                <div className="flex flex-col items-center pt-1">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    entry.type.includes("achievement") || entry.type.includes("strength") ? "bg-emerald-400" :
                    entry.type.includes("weakness") || entry.type.includes("failed") ? "bg-red-400" :
                    entry.type.includes("approval") || entry.type.includes("skill") ? "bg-violet-400" :
                    "bg-zinc-500"
                  )} />
                  {idx < filtered.length - 1 && <div className="mt-1 h-full w-px bg-zinc-800" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-zinc-200">{entry.title}</div>
                  <div className="mt-0.5 text-[0.65rem] text-zinc-500">{entry.description}</div>
                  {entry.trustAtTime > 0 && (
                    <div className="mt-1 flex gap-2 text-[0.55rem] text-zinc-600">
                      <span>Trust: {entry.trustAtTime.toFixed(0)}</span>
                      {entry.levelAtTime > 0 && <span>Level: {entry.levelAtTime}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODULE 4: Risk Center
// Composes: api.dashboard + api.employees.list + api.finance.metrics + api.approvals.pending
// ═════════════════════════════════════════════════════════════════════════════

function RiskCenterModule() {
  const { navigate } = useRouter();
  const { data: dash, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard.get(),
  });
  const { data: finance } = useQuery({
    queryKey: ["finance", "metrics"],
    queryFn: () => api.finance.metrics(),
  });
  const { data: pending = [] } = useQuery({
    queryKey: ["approvals", "pending"],
    queryFn: () => api.approvals.pending(),
  });

  if (isLoading) return <PageSkeleton variant="list" />;

  const employees = dash?.employees?.list || [];
  const lowTrust = employees.filter((e: any) => e.trustScore < 70);
  const highTrust = employees.filter((e: any) => e.trustScore >= 85);
  const approvalBottleneck = pending.length;
  const failedTasks = dash?.tasks?.failed || 0;

  const risks: Array<{ severity: "critical" | "high" | "medium" | "low"; title: string; description: string; count?: number; action?: { label: string; path: string } }> = [];

  if (approvalBottleneck > 0) {
    risks.push({ severity: "high", title: "Approval Bottleneck", description: `${approvalBottleneck} approval(s) pending — employees are paused`, count: approvalBottleneck, action: { label: "Review", path: "approvals" } });
  }
  if (failedTasks > 0) {
    risks.push({ severity: "critical", title: "Failed Automations", description: `${failedTasks} task(s) failed and need investigation`, count: failedTasks, action: { label: "Investigate", path: "tasks" } });
  }
  if (lowTrust.length > 0) {
    risks.push({ severity: "high", title: "Low Trust Employees", description: `${lowTrust.length} employee(s) below 70 trust score`, count: lowTrust.length, action: { label: "Review", path: "employees" } });
  }
  if (finance?.overdueCount > 0) {
    risks.push({ severity: "high", title: "Invoice Risks", description: `${finance.overdueCount} overdue invoice(s) totaling ${formatINRfinance(finance.totalOverdue)}`, count: finance.overdueCount, action: { label: "View", path: "finance" } });
  }
  if (finance?.customersAtRisk > 0) {
    risks.push({ severity: "medium", title: "Customer Risks", description: `${finance.customersAtRisk} high-risk customer(s) with overdue invoices`, count: finance.customersAtRisk, action: { label: "View", path: "finance" } });
  }
  if (finance?.escalatedCases > 0) {
    risks.push({ severity: "critical", title: "Escalated Cases", description: `${finance.escalatedCases} collection case(s) escalated`, count: finance.escalatedCases, action: { label: "Review", path: "finance" } });
  }

  return (
    <div className="space-y-4">
      {/* Risk summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RiskStat label="Critical" value={risks.filter(r => r.severity === "critical").length} color="text-red-400" />
        <RiskStat label="High" value={risks.filter(r => r.severity === "high").length} color="text-amber-400" />
        <RiskStat label="Medium" value={risks.filter(r => r.severity === "medium").length} color="text-sky-400" />
        <RiskStat label="High Trust Emp" value={highTrust.length} color="text-emerald-400" />
      </div>

      {/* Risk cards */}
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
              r.severity === "high" ? "border-amber-500/20 bg-amber-500/5" :
              r.severity === "medium" ? "border-sky-500/20 bg-sky-500/5" :
              "border-zinc-800 bg-zinc-900/50"
            )}>
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                r.severity === "critical" ? "bg-red-500/15 text-red-400" :
                r.severity === "high" ? "bg-amber-500/15 text-amber-400" :
                r.severity === "medium" ? "bg-sky-500/15 text-sky-400" :
                "bg-zinc-800 text-zinc-400"
              )}>
                <AlertOctagon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{r.title}</span>
                  {r.count !== undefined && <span className="text-lg font-bold text-zinc-200">{r.count}</span>}
                </div>
                <div className="text-xs text-zinc-400">{r.description}</div>
              </div>
              {r.action && (
                <button onClick={() => navigate(r.action!.path)} className="shrink-0 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800">
                  {r.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Trust distribution */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-zinc-100">Employee Trust Distribution</h3>
        <div className="space-y-2">
          {employees.map((e: any) => (
            <button key={e.id} onClick={() => navigate(`employees/${e.id}`)} className="flex w-full items-center gap-3 text-left">
              <Avatar name={e.name} color={e.avatarColor} size="sm" />
              <span className="w-24 truncate text-xs text-zinc-300">{e.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div className={cn(
                  "h-full rounded-full",
                  e.trustScore >= 85 ? "bg-emerald-500" : e.trustScore >= 70 ? "bg-amber-500" : "bg-red-500"
                )} style={{ width: `${e.trustScore}%` }} />
              </div>
              <span className={cn(
                "w-10 text-right text-xs font-bold",
                e.trustScore >= 85 ? "text-emerald-400" : e.trustScore >= 70 ? "text-amber-400" : "text-red-400"
              )}>
                {e.trustScore.toFixed(0)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODULE 5: Employee Resume
// Composes: api.employees.get + api.employees.profile + api.employees.businessImpact
//           + api.employees.achievements + api.capabilities.listForEmployee + api.employees.careerTimeline
// ═════════════════════════════════════════════════════════════════════════════

function ResumeModule() {
  const { navigate } = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", "active"],
    queryFn: () => api.employees.list({ status: "active" }),
  });

  const empId = selectedId || employees[0]?.id;

  const { data: profile } = useQuery({
    queryKey: ["employee", empId, "profile"],
    queryFn: () => api.employees.profile(empId!),
    enabled: !!empId,
  });
  const { data: businessImpact } = useQuery({
    queryKey: ["employee", empId, "business-impact"],
    queryFn: () => api.employees.businessImpact(empId!),
    enabled: !!empId,
  });
  const { data: achievements = [] } = useQuery({
    queryKey: ["employee", empId, "achievements"],
    queryFn: () => api.employees.achievements(empId!),
    enabled: !!empId,
  });
  const { data: capabilities = [] } = useQuery({
    queryKey: ["employee", empId, "capabilities"],
    queryFn: () => api.capabilities.listForEmployee(empId!),
    enabled: !!empId,
  });
  const { data: timeline = [] } = useQuery({
    queryKey: ["employee", empId, "career-timeline"],
    queryFn: () => api.employees.careerTimeline(empId!, 100),
    enabled: !!empId,
  });

  const employee = employees.find((e: any) => e.id === empId);
  const unlocked = achievements.filter((a: any) => a.unlocked);
  const promotions = timeline.filter((t: any) => t.entryType === "skill_promoted" || t.entryType === "level_up");

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {/* Employee picker */}
      <div className="lg:col-span-1">
        <div className="space-y-1.5">
          {employees.map((e: any) => (
            <button
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                empId === e.id ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-800 hover:border-zinc-700"
              )}
            >
              <Avatar name={e.name} color={e.avatarColor} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-zinc-200">{e.name}</div>
                <div className="truncate text-[0.6rem] text-zinc-500">{e.roleName}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Resume */}
      <div className="lg:col-span-3">
        {employee && profile && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            {/* Header */}
            <div className="border-b border-zinc-800 p-6">
              <div className="flex items-start gap-4">
                <Avatar name={employee.name} color={employee.avatarColor} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-zinc-50">{employee.name}</h2>
                  <p className="text-sm text-zinc-400">{employee.roleName} · {profile.department}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400">Level {profile.level} · {profile.title}</span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">{profile.experiencePoints} XP</span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">Trust {profile.trustScore.toFixed(1)}</span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">Hired {formatDate(employee.createdAt)}</span>
                  </div>
                </div>
                <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800">
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
              </div>
            </div>

            {/* Summary */}
            <ResumeSection title="Summary">
              <p className="text-sm leading-relaxed text-zinc-300">{employee.jobDescription}</p>
            </ResumeSection>

            {/* Experience */}
            <ResumeSection title="Experience">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ResumeMetric label="Tasks Completed" value={String(profile.completedTasks)} />
                <ResumeMetric label="Hours Saved" value={`${profile.hoursSaved.toFixed(1)}h`} />
                <ResumeMetric label="Customers Helped" value={String(profile.customersHandled)} />
                <ResumeMetric label="Invoices Processed" value={String(profile.invoicesProcessed)} />
              </div>
            </ResumeSection>

            {/* Skills */}
            <ResumeSection title="Skills">
              <div className="flex flex-wrap gap-2">
                {(profile.skills || []).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1">
                    <span className="text-xs text-zinc-200">{s.name}</span>
                    <span className="rounded bg-zinc-800 px-1 text-[0.55rem] text-zinc-400">L{s.level}</span>
                    <span className="text-[0.55rem] text-zinc-500">{(s.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </ResumeSection>

            {/* Promotion History */}
            <ResumeSection title="Promotion History">
              <div className="space-y-1.5">
                {promotions.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    <span className="text-zinc-300">{p.title}</span>
                    <span className="ml-auto text-[0.6rem] text-zinc-500">{formatDate(p.createdAt)}</span>
                  </div>
                ))}
                {promotions.length === 0 && <span className="text-xs text-zinc-600">No promotions yet</span>}
              </div>
            </ResumeSection>

            {/* Business Outcomes */}
            {businessImpact?.cumulative && (
              <ResumeSection title="Business Outcomes">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <ResumeMetric label="Money Recovered" value={formatINRfinance(businessImpact.cumulative.moneyRecovered)} />
                  <ResumeMetric label="Tasks Automated" value={String(businessImpact.cumulative.tasksAutomated)} />
                  <ResumeMetric label="Emails Sent" value={String(businessImpact.cumulative.emailsSent)} />
                  <ResumeMetric label="Success Streak" value={String(businessImpact.currentStreak)} />
                  <ResumeMetric label="Total Outcomes" value={String(businessImpact.totalOutcomes)} />
                  {businessImpact.largestRecovery && (
                    <ResumeMetric label="Largest Recovery" value={formatINRfinance(businessImpact.largestRecovery.amount)} />
                  )}
                </div>
              </ResumeSection>
            )}

            {/* Achievements */}
            <ResumeSection title="Achievements">
              <div className="grid gap-2 sm:grid-cols-2">
                {unlocked.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                    <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <div>
                      <div className="text-xs font-medium text-zinc-200">{a.name}</div>
                      <div className="text-[0.6rem] text-zinc-500">{a.description}</div>
                    </div>
                  </div>
                ))}
                {unlocked.length === 0 && <span className="text-xs text-zinc-600">No achievements unlocked yet</span>}
              </div>
            </ResumeSection>

            {/* Capabilities */}
            <ResumeSection title="Capabilities">
              <div className="flex flex-wrap gap-1.5">
                {capabilities.map((c: any) => (
                  <span key={c.id} className={cn(
                    "rounded px-2 py-0.5 font-mono text-[0.6rem]",
                    c.capability?.riskLevel === "critical" ? "bg-red-500/10 text-red-400" :
                    c.capability?.riskLevel === "high" ? "bg-amber-500/10 text-amber-400" :
                    "bg-zinc-800 text-zinc-400"
                  )}>
                    {c.capability?.code}
                  </span>
                ))}
              </div>
            </ResumeSection>

            {/* Restrictions */}
            <ResumeSection title="Restrictions">
              <ul className="space-y-1.5">
                {(employee.boundaries || []).map((b: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                    <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </ResumeSection>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODULE 6: CEO Report
// Composes: api.dashboard + api.employees.list + api.audit.list
// ═════════════════════════════════════════════════════════════════════════════

function CEOReportModule() {
  const { data: dash, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard.get(),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees", "active"],
    queryFn: () => api.employees.list({ status: "active" }),
  });
  const { data: audit = [] } = useQuery({
    queryKey: ["audit", "ceo-report"],
    queryFn: () => api.audit.list({ limit: 50 }),
  });

  if (isLoading) return <PageSkeleton variant="dashboard" />;
  if (!dash) return <ErrorState message="Failed to load report data" />;

  const impact = dash.businessImpact || {};
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8">
      {/* Report header */}
      <div className="flex items-start justify-between border-b border-zinc-800 pb-6">
        <div>
          <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-emerald-400">BIHARI AI — CEO Report</div>
          <h1 className="mt-1 text-2xl font-bold text-zinc-50">Enterprise Operations Report</h1>
          <p className="mt-1 text-sm text-zinc-500">Generated {today}</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
          <Printer className="h-4 w-4" /> Export PDF
        </button>
      </div>

      {/* Executive Summary */}
      <ReportSection title="Executive Summary">
        <p className="text-sm leading-relaxed text-zinc-300">
          Your AI Workforce completed <span className="font-semibold text-zinc-100">{impact.tasksAutomated || 0} tasks</span>, saving <span className="font-semibold text-emerald-400">{(impact.hoursSaved || 0).toFixed(1)} hours</span> of manual work.
          {impact.moneyRecovered > 0 && <> A total of <span className="font-semibold text-emerald-400">{formatINRfinance(impact.moneyRecovered)}</span> was recovered through automated collections.</>} The workforce operates at <span className="font-semibold text-zinc-100">{((impact.automationRate || 0) * 100).toFixed(0)}% automation rate</span> with <span className="font-semibold text-zinc-100">{((impact.humanApprovalRate || 0) * 100).toFixed(0)}% approval rate</span> and an average trust score of <span className="font-semibold text-emerald-400">{(impact.avgTrustScore || 0).toFixed(1)}/100</span>.
        </p>
      </ReportSection>

      {/* Business KPIs */}
      <ReportSection title="Business KPIs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReportKPI label="Money Pending" value={formatINRfinance(impact.moneyPending || 0)} />
          <ReportKPI label="Money Recovered" value={formatINRfinance(impact.moneyRecovered || 0)} />
          <ReportKPI label="Hours Saved" value={`${(impact.hoursSaved || 0).toFixed(1)}h`} />
          <ReportKPI label="Tasks Automated" value={String(impact.tasksAutomated || 0)} />
          <ReportKPI label="Customers Contacted" value={String(impact.customersContacted || 0)} />
          <ReportKPI label="Emails Sent" value={String(impact.emailsSent || 0)} />
          <ReportKPI label="Automation Rate" value={`${((impact.automationRate || 0) * 100).toFixed(0)}%`} />
          <ReportKPI label="Avg Trust Score" value={`${(impact.avgTrustScore || 0).toFixed(1)}/100`} />
        </div>
      </ReportSection>

      {/* Employee KPIs */}
      <ReportSection title="Employee KPIs">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-500">
              <th className="pb-2 font-medium">Employee</th>
              <th className="pb-2 text-right font-medium">Trust</th>
              <th className="pb-2 text-right font-medium">Tasks</th>
              <th className="pb-2 text-right font-medium">Recovered</th>
              <th className="pb-2 text-right font-medium">Hours</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e: any) => (
              <tr key={e.id} className="border-b border-zinc-800/50">
                <td className="py-2 text-zinc-200">{e.name}</td>
                <td className="py-2 text-right font-mono text-emerald-400">{e.trustScore?.toFixed(0) || "—"}</td>
                <td className="py-2 text-right text-zinc-300">{e.tasksAutomated || 0}</td>
                <td className="py-2 text-right text-emerald-400">{e.moneyRecovered > 0 ? formatINRfinance(e.moneyRecovered) : "—"}</td>
                <td className="py-2 text-right text-zinc-300">{e.hoursSaved?.toFixed(1) || 0}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>

      {/* Trust + Learning */}
      <ReportSection title="Trust & Learning">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-800 p-3">
            <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">Approval Rate</div>
            <div className="mt-1 text-xl font-bold text-emerald-400">{((impact.humanApprovalRate || 0) * 100).toFixed(0)}%</div>
          </div>
          <div className="rounded-lg border border-zinc-800 p-3">
            <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">Avg Trust Trend</div>
            <div className="mt-1 text-xl font-bold text-zinc-200">{(impact.avgTrustScore || 0).toFixed(1)} / 100</div>
          </div>
        </div>
      </ReportSection>

      {/* Risks */}
      <ReportSection title="Risks">
        <ul className="space-y-1.5 text-sm">
          {dash.tasks?.failed > 0 && <li className="flex items-center gap-2 text-zinc-300"><AlertOctagon className="h-3.5 w-3.5 text-red-400" /> {dash.tasks.failed} failed automation(s)</li>}
          {dash.finance?.overdueCount > 0 && <li className="flex items-center gap-2 text-zinc-300"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> {dash.finance.overdueCount} overdue invoice(s)</li>}
          {dash.finance?.customersAtRisk > 0 && <li className="flex items-center gap-2 text-zinc-300"><Users className="h-3.5 w-3.5 text-amber-400" /> {dash.finance.customersAtRisk} customer(s) at risk</li>}
          {dash.approvals?.pending > 0 && <li className="flex items-center gap-2 text-zinc-300"><Clock className="h-3.5 w-3.5 text-amber-400" /> {dash.approvals.pending} approval(s) pending</li>}
          {dash.tasks?.failed === 0 && dash.finance?.overdueCount === 0 && <li className="flex items-center gap-2 text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> No critical risks identified</li>}
        </ul>
      </ReportSection>

      {/* Audit Summary */}
      <ReportSection title="Audit Summary">
        <p className="text-sm text-zinc-400">
          {audit.length} audit events recorded in the hash-chained audit trail.
          All actions are tamper-detectable via SHA-256 hash verification.
        </p>
        <div className="mt-2 text-[0.6rem] text-zinc-600">
          Latest entry: #{audit[0]?.sequenceNumber} · {audit[0] && formatDateTime(audit[0].createdAt)}
        </div>
      </ReportSection>

      {/* Footer */}
      <div className="mt-6 border-t border-zinc-800 pt-4 text-center text-[0.6rem] text-zinc-600">
        BIHARI AI — Enterprise Operations Report · Generated {today} · Confidential
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODULE 7: Customer Trust Report
// Composes: api.finance.customers + api.finance.invoices + api.audit.list
// ═════════════════════════════════════════════════════════════════════════════

function CustomerTrustReportModule() {
  const [customerId, setCustomerId] = useState<string>("");

  const { data: customers = [] } = useQuery({
    queryKey: ["finance", "customers"],
    queryFn: () => api.finance.customers(),
  });

  const selectedId = customerId || customers[0]?.id;

  const { data: invoices = [] } = useQuery({
    queryKey: ["finance", "invoices", selectedId],
    queryFn: () => api.finance.invoices({ customerId: selectedId }),
    enabled: !!selectedId,
  });

  const { data: audit = [] } = useQuery({
    queryKey: ["audit", "customer", selectedId],
    queryFn: () => api.audit.list({ limit: 30 }),
    enabled: !!selectedId,
  });

  const customer = customers.find((c: any) => c.id === selectedId);
  const customerAudit = audit.filter((a: any) => {
    const desc = a.businessDescription || "";
    const payloadStr = typeof a.payload === "string" ? a.payload : JSON.stringify(a.payload || {});
    return desc.includes(customer?.name || "___INVALID___") || payloadStr.includes(selectedId || "___INVALID___");
  });
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      {/* Customer picker */}
      <div className="mb-4">
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="h-9 w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-emerald-500"
        >
          <option value="">Select a customer…</option>
          {customers.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {customer && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-800 pb-6">
            <div>
              <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-emerald-400">BIHARI AI — Customer Trust Report</div>
              <h1 className="mt-1 text-2xl font-bold text-zinc-50">{customer.name}</h1>
              <p className="mt-1 text-sm text-zinc-500">Generated {today}</p>
            </div>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
              <Printer className="h-4 w-4" /> Export PDF
            </button>
          </div>

          {/* Customer overview */}
          <ReportSection title="Customer Overview">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ReportKPI label="Total Outstanding" value={formatINRfinance(customer.totalOutstanding)} />
              <ReportKPI label="Overdue Invoices" value={String(customer.overdueCount)} />
              <ReportKPI label="Risk Level" value={customer.riskLevel} />
              <ReportKPI label="Payment Terms" value={`${customer.paymentTerms} days`} />
            </div>
          </ReportSection>

          {/* What happened */}
          <ReportSection title="What Happened">
            <div className="space-y-1.5">
              {customerAudit.slice(0, 8).map((a: any) => (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <SeverityDot severity={a.severity || "info"} />
                  <div className="flex-1">
                    <span className="font-medium text-zinc-200">{a.businessEvent || a.entryType?.replace(/_/g, " ")}</span>
                    <span className="ml-2 text-zinc-500">{a.businessDescription}</span>
                  </div>
                  <span className="text-[0.6rem] text-zinc-500">{formatRelativeTime(a.createdAt)}</span>
                </div>
              ))}
              {customerAudit.length === 0 && <p className="text-xs text-zinc-600">No recorded activity for this customer</p>}
            </div>
          </ReportSection>

          {/* What AI recommended */}
          <ReportSection title="What AI Recommended">
            <div className="space-y-2">
              {invoices.filter((i: any) => i.reminderCount > 0).slice(0, 5).map((inv: any) => (
                <div key={inv.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-zinc-300">{inv.invoiceNumber}</span>
                    <span className="text-xs text-zinc-500">{inv.daysOverdue} days overdue</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    AI recommended: Send {inv.reminderCount === 1 ? "first reminder" : "follow-up reminder"} for {formatINRfinance(inv.outstanding)} outstanding
                  </div>
                </div>
              ))}
              {invoices.filter((i: any) => i.reminderCount > 0).length === 0 && <p className="text-xs text-zinc-600">No AI recommendations made</p>}
            </div>
          </ReportSection>

          {/* Business impact */}
          <ReportSection title="Business Impact">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ReportKPI label="Invoices Processed" value={String(invoices.length)} />
              <ReportKPI label="Reminders Sent" value={String(invoices.reduce((s: number, i: any) => s + i.reminderCount, 0))} />
              <ReportKPI label="Total Value" value={formatINRfinance(invoices.reduce((s: number, i: any) => s + i.total, 0))} />
            </div>
          </ReportSection>

          {/* Audit trail */}
          <ReportSection title="Audit Trail">
            <p className="text-sm text-zinc-400">
              All actions related to this customer are recorded in the hash-chained audit trail.
              Every event is tamper-detectable via SHA-256 verification.
            </p>
            <div className="mt-2 text-[0.6rem] text-zinc-600">
              {customerAudit.length} audit events reference this customer
            </div>
          </ReportSection>

          <div className="mt-6 border-t border-zinc-800 pt-4 text-center text-[0.6rem] text-zinc-600">
            BIHARI AI — Customer Trust Report · {customer.name} · Generated {today} · Confidential
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODULE 8: Security Overview
// Composes: api.dashboard + api.employees.list + api.capabilities.list + api.audit.list
// ═════════════════════════════════════════════════════════════════════════════

function SecurityOverviewModule() {
  const { data: dash, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard.get(),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.employees.list(),
  });
  const { data: capabilities = [] } = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => api.capabilities.list(),
  });
  const { data: audit = [] } = useQuery({
    queryKey: ["audit", "security"],
    queryFn: () => api.audit.list({ limit: 100 }),
  });

  if (isLoading) return <PageSkeleton variant="list" />;

  const criticalCaps = capabilities.filter((c: any) => c.riskLevel === "critical");
  const highRiskCaps = capabilities.filter((c: any) => c.riskLevel === "high");
  const totalCaps = capabilities.length;
  const auditEntries = audit.length;
  const hashChainVerified = audit.length > 0 ? "Not verified" : "—"; // Requires backend verification endpoint

  return (
    <div className="space-y-4">
      {/* Security summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SecurityStat label="Employees" value={String(employees.length)} icon={Bot} color="text-emerald-400" />
        <SecurityStat label="Capabilities" value={String(totalCaps)} icon={Key} color="text-sky-400" />
        <SecurityStat label="Audit Events" value={String(auditEntries)} icon={Database} color="text-violet-400" />
        <SecurityStat label="Hash Chain" value={hashChainVerified} icon={ShieldCheck} color="text-zinc-400" />
      </div>

      {/* Workspace security */}
      <SecurityCard title="Workspace" icon={Building2}>
        <SecurityRow label="Workspace ID" value={dash?.employees?.list?.[0] ? "Active" : "—"} />
        <SecurityRow label="Active Employees" value={String(employees.filter((e: any) => e.status === "active").length)} />
        <SecurityRow label="Paused Employees" value={String(employees.filter((e: any) => e.status === "paused").length)} />
        <SecurityRow label="Active Policies" value={String(dash?.activePolicies || 0)} />
      </SecurityCard>

      {/* Capabilities */}
      <SecurityCard title="Capability Matrix" icon={Key}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SecurityStat label="Total" value={String(totalCaps)} icon={Key} color="text-zinc-300" />
          <SecurityStat label="Critical" value={String(criticalCaps.length)} icon={AlertOctagon} color="text-red-400" />
          <SecurityStat label="High Risk" value={String(highRiskCaps.length)} icon={AlertTriangle} color="text-amber-400" />
          <SecurityStat label="Low Risk" value={String(capabilities.filter((c: any) => c.riskLevel === "low").length)} icon={CheckCircle2} color="text-emerald-400" />
        </div>
        <div className="mt-3">
          <div className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">Critical Capabilities</div>
          <div className="flex flex-wrap gap-1.5">
            {criticalCaps.map((c: any) => (
              <span key={c.id} className="rounded bg-red-500/10 px-2 py-0.5 font-mono text-[0.6rem] text-red-400">{c.code}</span>
            ))}
            {criticalCaps.length === 0 && <span className="text-[0.65rem] text-zinc-600">No critical capabilities defined</span>}
          </div>
        </div>
      </SecurityCard>

      {/* Audit integrity */}
      <SecurityCard title="Audit Integrity" icon={ShieldCheck}>
        <SecurityRow label="Total Events" value={String(auditEntries)} />
        <SecurityRow label="Hash Chain" value={hashChainVerified} status="unknown" />
        <SecurityRow label="Latest Entry" value={audit[0] ? `#${audit[0].sequenceNumber}` : "—"} />
        <SecurityRow label="Latest Hash" value={audit[0]?.entryHash?.slice(0, 16) + "…" || "—"} mono />
      </SecurityCard>

      {/* Approvals */}
      <SecurityCard title="Approval Gate" icon={Lock}>
        <SecurityRow label="Pending Approvals" value={String(dash?.approvals?.pending || 0)} status={(dash?.approvals?.pending || 0) > 0 ? "warning" : "ok"} />
        <SecurityRow label="Approval Rate" value={`${((dash?.approvals?.approvalRate || 0) * 100).toFixed(0)}%`} />
        <SecurityRow label="Decided Today" value={String(dash?.approvals?.decidedToday || 0)} />
        <SecurityRow label="Rejected Today" value={String(dash?.approvals?.rejectedToday || 0)} status={(dash?.approvals?.rejectedToday || 0) > 0 ? "warning" : "ok"} />
      </SecurityCard>

      {/* Memory + Learning */}
      <SecurityCard title="Memory & Learning" icon={Brain}>
        <SecurityRow label="Active Documents" value={String(dash?.documents?.total || 0)} />
        <SecurityRow label="Ready" value={String(dash?.documents?.ready || 0)} status="ok" />
        <SecurityRow label="Processing" value={String(dash?.documents?.processing || 0)} status={(dash?.documents?.processing || 0) > 0 ? "warning" : "ok"} />
        <SecurityRow label="Failed" value={String(dash?.documents?.failed || 0)} status={(dash?.documents?.failed || 0) > 0 ? "error" : "ok"} />
      </SecurityCard>
    </div>
  );
}

// ─── Shared Sub-components ───────────────────────────────────────────────────

function CardMetric({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-zinc-900/50 p-3">
      <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={cn("mt-1 text-sm font-bold", highlight ? "text-emerald-400" : "text-zinc-100")}>{value}</div>
      {sub && <div className="text-[0.55rem] text-zinc-600">{sub}</div>}
    </div>
  );
}

function ExplainCell({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="mt-1.5 text-xs text-zinc-300">{value}</p>
    </div>
  );
}

function RiskStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={cn("mt-1 text-lg font-bold", color)}>{value}</div>
    </div>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-800 p-5 last:border-0">
      <h3 className="mb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

function ResumeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-base font-bold text-zinc-100">{value}</div>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-800 py-5 last:border-0">
      <h2 className="mb-3 text-sm font-semibold text-zinc-100">{title}</h2>
      {children}
    </div>
  );
}

function ReportKPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-base font-bold text-zinc-100">{value}</div>
    </div>
  );
}

function SecurityCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SecurityRow({ label, value, status, mono }: { label: string; value: string; status?: "ok" | "warning" | "error" | "unknown"; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800/50 py-2 last:border-0">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={cn(
        "text-xs font-medium",
        mono && "font-mono",
        status === "ok" ? "text-emerald-400" :
        status === "warning" ? "text-amber-400" :
        status === "error" ? "text-red-400" :
        "text-zinc-200"
      )}>
        {value}
      </span>
    </div>
  );
}

function SecurityStat({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[0.6rem] uppercase tracking-wider text-zinc-500">{label}</span>
        <Icon className={cn("h-3.5 w-3.5", color)} />
      </div>
      <div className={cn("mt-1 text-lg font-bold", color)}>{value}</div>
    </div>
  );
}

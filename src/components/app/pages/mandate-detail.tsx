/**
 * BIHARI AI — Mandate Detail Page
 *
 * Answers every question a grantor would ask of a Mandate they entrusted:
 *   WHAT did I entrust?   → Declaration
 *   WHAT is it making true? → Desired state + success criteria + health
 *   WHAT authority does it have? → Autonomous / approval-required / forbidden
 *   WHO is the tenant?   → The AI employee currently executing (replaceable)
 *   WHAT has it done?    → Recent episodes (tasks) + audit ledger
 *   WHAT has it learned? → Mandate memory (survives tenant replacement)
 *   HOW successful is it? → Health score + outcome
 *   WHAT if it fails?    → Breach handling + revocation
 *   WHO is accountable?  → Grantor + tenant + audit chain
 *
 * The central architectural test is visible here: the "Reassign Tenant" action
 * proves the Mandate survives tenant replacement — declaration, authority,
 * memory, ledger, and outcomes all persist.
 */

"use client";

import { useState } from "react";
import { useRouter } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Scroll,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Activity,
  Clock,
  Brain,
  History,
  RefreshCw,
  Pause,
  Play,
  XCircle,
  Replace,
  CheckCircle2,
  Loader2,
  Lock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

const STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-400" },
  paused: { label: "Paused", className: "bg-amber-500/15 text-amber-400" },
  proposed: { label: "Proposed", className: "bg-zinc-500/15 text-zinc-400" },
  granted: { label: "Granted", className: "bg-blue-500/15 text-blue-400" },
  resolved: { label: "Resolved", className: "bg-teal-500/15 text-teal-400" },
  revoked: { label: "Revoked", className: "bg-zinc-600/15 text-zinc-500" },
  breached: { label: "Breached", className: "bg-red-500/15 text-red-400" },
};

function healthColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

export function MandateDetailPage({ mandateId }: { mandateId: string }) {
  const { navigate } = useRouter();
  const qc = useQueryClient();
  const [showReassign, setShowReassign] = useState(false);

  const { data: mandate, isLoading } = useQuery({
    queryKey: ["mandate", mandateId],
    queryFn: () => api.mandates.get(mandateId),
    refetchInterval: 15000,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", "active"],
    queryFn: () => api.employees.list({ status: "active" }),
    enabled: showReassign,
  });

  // Outcome timeline — chronological business + AI events
  const { data: timeline = [] } = useQuery({
    queryKey: ["mandate", mandateId, "timeline"],
    queryFn: () => api.mandates.timeline(mandateId),
    refetchInterval: 15000,
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.mandates.pause(mandateId, "Paused by grantor"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mandate", mandateId] }),
  });
  const resumeMutation = useMutation({
    mutationFn: () => api.mandates.resume(mandateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mandate", mandateId] }),
  });
  const revokeMutation = useMutation({
    mutationFn: () => api.mandates.revoke(mandateId, "Revoked by grantor"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mandate", mandateId] }),
  });
  const reassignMutation = useMutation({
    mutationFn: (newTenantId: string) => api.mandates.reassign(mandateId, newTenantId, "Tenant replaced by grantor"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mandate", mandateId] });
      setShowReassign(false);
    },
  });
  const evaluateMutation = useMutation({
    mutationFn: () => api.mandates.evaluate(mandateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mandate", mandateId] }),
  });

  if (isLoading || !mandate) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const status = STATUS_META[mandate.status] || STATUS_META.proposed;
  const authority = mandate.authority || { autonomous: [], requiresApproval: [], forbidden: [], escalationTriggers: [] };
  const isActive = mandate.status === "active";
  const isTerminal = ["resolved", "revoked", "breached"].includes(mandate.status);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate("mandates")}
        className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Mandates
      </button>

      {/* Header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
                <Scroll className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-zinc-50">{mandate.title}</h1>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                  <span>Mandate v{mandate.version}</span>
                  <span>·</span>
                  <span>Granted by {mandate.grantor?.name}</span>
                  <span>·</span>
                  <span>{new Date(mandate.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              </div>
            </div>
          </div>
          <span className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", status.className)}>
            <Activity className="h-3.5 w-3.5" />
            {status.label}
          </span>
        </div>

        {/* Declaration */}
        <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Declaration — the desired state entrusted to AI</div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-200">{mandate.declaration}</p>
        </div>

        {/* Actions */}
        {!isTerminal && (
          <div className="mt-4 flex flex-wrap gap-2">
            {isActive ? (
              <button
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
              >
                <Pause className="h-3.5 w-3.5" /> Pause
              </button>
            ) : mandate.status === "paused" ? (
              <button
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
              >
                <Play className="h-3.5 w-3.5" /> Resume
              </button>
            ) : null}
            <button
              onClick={() => evaluateMutation.mutate()}
              disabled={evaluateMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", evaluateMutation.isPending && "animate-spin")} /> Re-evaluate Health
            </button>
            <button
              onClick={() => setShowReassign(!showReassign)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
            >
              <Replace className="h-3.5 w-3.5" /> Reassign Tenant
            </button>
            <button
              onClick={() => revokeMutation.mutate()}
              disabled={revokeMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-red-800 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20"
            >
              <XCircle className="h-3.5 w-3.5" /> Revoke
            </button>
          </div>
        )}
      </div>

      {/* Tenant reassignment panel — the central architectural test */}
      {showReassign && (
        <div className="rounded-xl border border-blue-800 bg-blue-500/5 p-5">
          <div className="flex items-center gap-2">
            <Replace className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Reassign Tenant</h3>
          </div>
          <p className="mt-1.5 text-xs text-zinc-400">
            The Mandate survives tenant replacement. The declaration, authority, memory, ledger, and outcome history are all preserved — the new tenant inherits the full accumulated context.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {employees.filter((e: any) => e.id !== mandate.tenantId).map((e: any) => (
              <button
                key={e.id}
                onClick={() => reassignMutation.mutate(e.id)}
                disabled={reassignMutation.isPending}
                className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-blue-600 hover:bg-blue-500/10"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/15 text-[0.6rem] font-bold text-emerald-400">
                  {e.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                </div>
                {e.name}
              </button>
            ))}
            {employees.filter((e: any) => e.id !== mandate.tenantId).length === 0 && (
              <p className="text-xs text-zinc-500">No other active employees available. Hire a new employee to reassign.</p>
            )}
          </div>
        </div>
      )}

      {/* Health + Outcome */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Desired-State Health</h3>
            {mandate.lastEvaluatedAt && (
              <span className="text-[0.65rem] text-zinc-500">
                Evaluated {new Date(mandate.lastEvaluatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className={cn("text-4xl font-bold", healthColor(mandate.healthScore))}>{Math.round(mandate.healthScore)}%</div>
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={cn("h-full rounded-full", mandate.healthScore >= 80 ? "bg-emerald-500" : mandate.healthScore >= 50 ? "bg-amber-500" : "bg-red-500")}
                  style={{ width: `${mandate.healthScore}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-400">{mandate.healthNote || "Health not yet evaluated."}</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Success Criteria</div>
            <code className="mt-1 block text-xs text-emerald-400">{mandate.successCriteria}</code>
          </div>
        </div>

        {/* Tenant */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-sm font-semibold text-zinc-200">AI Tenant</h3>
          <p className="mt-1 text-[0.65rem] text-zinc-500">The executor currently pursuing this Mandate. Replaceable — the Mandate outlives any tenant.</p>
          {mandate.tenant ? (
            <button
              onClick={() => navigate(`employees/${mandate.tenant.id}`)}
              className="mt-3 flex w-full items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-left transition-colors hover:border-zinc-700"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-sm font-bold text-emerald-400">
                {mandate.tenant.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-100">{mandate.tenant.name}</div>
                <div className="truncate text-xs text-zinc-500">{mandate.tenant.role === "finance_employee" ? "Finance Employee" : mandate.tenant.role}</div>
              </div>
            </button>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-zinc-800 p-3 text-center text-xs text-zinc-500">
              Unassigned — grant to a tenant to activate
            </div>
          )}
        </div>
      </div>

      {/* Outcome Economics — Activity vs Outcome */}
      {mandate.economics && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Outcome Economics
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Is this responsibility actually being fulfilled? Activity (what the AI did) ≠ Outcome (whether the desired state is met). 100 reminders sent ≠ healthy receivables.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Outcome metrics */}
            <div className="rounded-lg border border-emerald-900/50 bg-emerald-500/5 p-3">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-400">Overdue Rate (Outcome)</div>
              <div className="mt-1 text-xl font-bold text-zinc-100">{(mandate.economics.currentOverdueRate * 100).toFixed(1)}%</div>
              <div className="text-[0.6rem] text-zinc-500">Target: ≤ {(mandate.economics.targetOverdueRate * 100).toFixed(0)}% · Gap: +{(mandate.economics.gap * 100).toFixed(1)}pp</div>
            </div>
            <div className="rounded-lg border border-emerald-900/50 bg-emerald-500/5 p-3">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-400">Total Recovered</div>
              <div className="mt-1 text-xl font-bold text-emerald-400">₹{Math.round(mandate.economics.totalRecovered / 100).toLocaleString("en-IN")}</div>
              <div className="text-[0.6rem] text-zinc-500">{mandate.economics.completedEpisodes} episodes · ₹{Math.round(mandate.economics.recoveryVelocity / 100).toLocaleString("en-IN")}/episode</div>
            </div>
            {/* Activity metrics (deliberately separate from outcome) */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Reminders Sent (Activity)</div>
              <div className="mt-1 text-xl font-bold text-zinc-300">{mandate.economics.remindersSent}</div>
              <div className="text-[0.6rem] text-zinc-600">{mandate.economics.customerResponses} customer responses</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Episodes (Activity)</div>
              <div className="mt-1 text-xl font-bold text-zinc-300">{mandate.economics.totalEpisodes}</div>
              <div className="text-[0.6rem] text-zinc-600">{mandate.economics.completedEpisodes} completed · {mandate.economics.failedEpisodes} failed</div>
            </div>
          </div>
          {/* Net value + intervention economics */}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Net Value Created</div>
              <div className="mt-1 text-lg font-bold text-emerald-400">₹{Math.round(mandate.economics.netValue / 100).toLocaleString("en-IN")}</div>
              <div className="text-[0.6rem] text-zinc-600">Recovered ₹{Math.round(mandate.economics.totalRecovered / 100).toLocaleString("en-IN")} − Cost ₹{Math.round(mandate.economics.executionCostEstimate / 100).toLocaleString("en-IN")}</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Human Intervention</div>
              <div className="mt-1 text-lg font-bold text-zinc-300">{(mandate.economics.humanInterventionRate * 100).toFixed(0)}%</div>
              <div className="text-[0.6rem] text-zinc-600">Approval rate: {(mandate.economics.approvalRate * 100).toFixed(0)}%</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Failure Rate</div>
              <div className="mt-1 text-lg font-bold text-zinc-300">{(mandate.economics.failureRate * 100).toFixed(0)}%</div>
              <div className="text-[0.6rem] text-zinc-600">{mandate.economics.failedEpisodes} of {mandate.economics.totalEpisodes} episodes failed</div>
            </div>
          </div>
          <div className="mt-2 text-[0.6rem] text-zinc-600">
            DEMO DATA: Recovery figures are based on seeded payment data. Execution cost is estimated from token usage at approximate Gemini Flash rates. Do not present as real customer outcomes.
          </div>
        </div>
      )}

      {/* Authority */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Granted Authority
        </h3>
        <p className="mt-1 text-xs text-zinc-500">The boundary of trust. What the tenant may do autonomously, what needs your approval, and what is forbidden.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-emerald-900/50 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Autonomous
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {authority.autonomous.length > 0 ? authority.autonomous.map((a: string) => (
                <span key={a} className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[0.65rem] text-emerald-300">{a}</span>
              )) : <span className="text-xs text-zinc-600">None</span>}
            </div>
          </div>
          <div className="rounded-lg border border-amber-900/50 bg-amber-500/5 p-3">
            <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-amber-400">
              <Clock className="h-3 w-3" /> Requires Approval
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {authority.requiresApproval.length > 0 ? authority.requiresApproval.map((a: string) => (
                <span key={a} className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[0.65rem] text-amber-300">{a}</span>
              )) : <span className="text-xs text-zinc-600">None</span>}
            </div>
          </div>
          <div className="rounded-lg border border-red-900/50 bg-red-500/5 p-3">
            <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-red-400">
              <Lock className="h-3 w-3" /> Forbidden
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {authority.forbidden.length > 0 ? authority.forbidden.map((a: string) => (
                <span key={a} className="rounded bg-red-500/15 px-1.5 py-0.5 text-[0.65rem] text-red-300">{a}</span>
              )) : <span className="text-xs text-zinc-600">None</span>}
            </div>
          </div>
        </div>
        {authority.escalationTriggers.length > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <div className="text-xs text-zinc-400">
              <span className="font-medium text-zinc-300">Escalation triggers:</span> {authority.escalationTriggers.join(", ")}
            </div>
          </div>
        )}
      </div>

      {/* Memory — survives tenant replacement */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Brain className="h-4 w-4 text-violet-400" />
          Mandate Memory
          <span className="ml-auto text-[0.65rem] font-normal text-zinc-500">{mandate._count?.memory || 0} entries</span>
        </h3>
        <p className="mt-1 text-xs text-zinc-500">Accumulated context scoped to this Mandate. Survives tenant replacement — the new tenant inherits this judgment.</p>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {(mandate.memory || []).length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-600">No memory entries yet. The Mandate learns from each episode.</p>
          ) : mandate.memory.map((mem: any) => (
            <div key={mem.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="flex items-center justify-between">
                <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[0.6rem] font-medium text-violet-300">{mem.memoryType.replace(/_/g, " ")}</span>
                <div className="flex items-center gap-2 text-[0.6rem] text-zinc-600">
                  {mem.sourceType && <span className="rounded bg-zinc-800 px-1 py-0.5">via {mem.sourceType}</span>}
                  {typeof mem.importance === "number" && <span>confidence: {Math.round(mem.importance * 100)}%</span>}
                  <span>{new Date(mem.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-zinc-300">{mem.content}</p>
              {mem.sourceId && (
                <div className="mt-1 text-[0.6rem] text-zinc-600">Provenance: episode {mem.sourceId.slice(-8)}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent episodes + audit ledger */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Activity className="h-4 w-4 text-emerald-400" />
            Recent Episodes
          </h3>
          <p className="mt-1 text-xs text-zinc-500">Tasks spawned by this Mandate to make progress toward the desired state.</p>
          <div className="mt-3 space-y-2">
            {(mandate.tasks || []).length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-600">No episodes yet. The Mandate will spawn tasks as needed.</p>
            ) : mandate.tasks.map((t: any) => (
              <button
                key={t.id}
                onClick={() => navigate("tasks")}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-left transition-colors hover:border-zinc-700"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-zinc-200">{t.title}</div>
                  <div className="text-[0.6rem] text-zinc-500">{new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {t.stepCount} steps</div>
                </div>
                <span className={cn("ml-2 shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-medium",
                  t.status === "completed" ? "bg-emerald-500/15 text-emerald-400" :
                  t.status === "failed" ? "bg-red-500/15 text-red-400" :
                  t.status === "waiting_approval" ? "bg-amber-500/15 text-amber-400" :
                  "bg-blue-500/15 text-blue-400"
                )}>{t.status.replace(/_/g, " ")}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <History className="h-4 w-4 text-zinc-400" />
            Audit Ledger
          </h3>
          <p className="mt-1 text-xs text-zinc-500">Hash-chained record of every action taken under this Mandate. The accountable body.</p>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {(mandate.auditEntries || []).length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-600">No audit entries yet.</p>
            ) : mandate.auditEntries.map((a: any) => (
              <div key={a.id} className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5">
                <span className="mt-0.5 text-[0.6rem] font-mono text-zinc-600">#{a.sequenceNumber}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-zinc-300">{a.entryType.replace(/_/g, " ")}</div>
                  <div className="text-[0.6rem] text-zinc-600">{new Date(a.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Outcome Timeline — chronological business + AI events */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Activity className="h-4 w-4 text-emerald-400" />
          Outcome Timeline
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Chronological view of AI actions and business outcomes. Activity ≠ outcome. Simulated/mock events are labeled.
        </p>
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {timeline.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-600">No events yet. The Mandate will generate events as it observes and acts.</p>
          ) : timeline.map((event: any) => {
            const isLifecycle = event.evidenceType === "lifecycle";
            const isOutcome = event.evidenceType === "outcome";
            const isMock = event.simulated;
            return (
              <div key={event.id} className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    isMock ? "bg-amber-500" : isOutcome ? "bg-emerald-500" : isLifecycle ? "bg-violet-500" : "bg-zinc-500"
                  )} />
                  <div className="mt-1 w-px flex-1 bg-zinc-800" />
                </div>
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-200">{event.title}</span>
                    {isMock && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-400">SIMULATED</span>
                    )}
                    {isOutcome && !isMock && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-emerald-400">OUTCOME</span>
                    )}
                  </div>
                  {event.description && (
                    <p className="mt-0.5 text-[0.7rem] text-zinc-500">{event.description}</p>
                  )}
                  <div className="mt-0.5 text-[0.6rem] text-zinc-600">
                    {new Date(event.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

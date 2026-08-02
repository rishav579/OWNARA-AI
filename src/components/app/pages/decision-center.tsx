"use client";

import { useState } from "react";
import { useRouter, formatRelativeTime, formatDateTime } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  ApprovalStatusBadge,
  Avatar,
  CriticalityBadge,
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Check,
  X,
  Edit3,
  Lock,
  Clock,
  History,
  Inbox,
  FileText,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  RotateCcw,
  Eye,
  Hash,
  User,
  FileCheck,
  Activity,
} from "lucide-react";

const EVIDENCE_GROUPS = [
  { key: "invoice", label: "Invoice", icon: FileText },
  { key: "customer", label: "Customer", icon: User },
  { key: "payment_history", label: "Payment History", icon: TrendingUp },
  { key: "reminder_history", label: "Reminder History", icon: History },
  { key: "human_feedback", label: "Memory", icon: Activity },
  { key: "policy", label: "Policies", icon: ShieldCheck },
];

function formatINR(paise: number | string): string {
  const n = typeof paise === "string" ? parseInt(paise) : paise;
  if (isNaN(n)) return String(paise);
  const rupees = n / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)} L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

function formatHash(hash: string): string {
  if (!hash) return "—";
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function DecisionCenterPage() {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModify, setShowModify] = useState(false);
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading: pendingLoading, isError: pendingError, refetch: refetchPending } = useQuery({
    queryKey: ["approvals", "pending"],
    queryFn: () => api.approvals.pending(),
  });

  const { data: history = [], isLoading: historyLoading, isError: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ["approvals", "history"],
    queryFn: () => api.approvals.list("all"),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, reason, modifiedAction }: { id: string; reason?: string; modifiedAction?: string }) =>
      api.approvals.approve(id, { reason, modifiedAction }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.approvals.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const list = tab === "pending" ? pending : history;
  const selected = list.find((a: any) => a.id === selectedId) || list[0];
  const isLoading = tab === "pending" ? pendingLoading : historyLoading;
  const isError = tab === "pending" ? pendingError : historyError;
  const refetch = tab === "pending" ? refetchPending : refetchHistory;

  if (isError) {
    return (
      <div>
        <PageHeader title="Decision Center" description="Review irreversible AI actions before they execute" />
        <ErrorState message="Failed to load approvals" cause="The server may be unreachable or your session may have expired." action="Try refreshing the page. If the problem persists, sign in again." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Decision Center"
        description={
          pending.length > 0
            ? `${pending.length} irreversible actions awaiting your review`
            : "Every irreversible AI action is reviewed here"
        }
      />

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1 sm:w-fit">
        <button
          onClick={() => setTab("pending")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors",
            tab === "pending" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Inbox className="h-3.5 w-3.5" />
          Pending
          {pending.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[0.6rem] font-bold text-amber-950">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("history")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors",
            tab === "history" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <History className="h-3.5 w-3.5" />
          History
        </button>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={tab === "pending" ? "No pending decisions" : "No decision history yet"}
          description={tab === "pending" ? "AI Employees are working. Irreversible actions will appear here for your review." : "Decided actions will appear here with full contract history."}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* List */}
          <div className="space-y-2 lg:col-span-2">
            {list.map((a: any) => {
              const contract = a.contract || a.proposedAction;
              return (
                <button
                  key={a.id}
                  onClick={() => { setSelectedId(a.id); setShowModify(false); }}
                  className={cn(
                    "flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition-all",
                    selected?.id === a.id
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={a.employeeName} color={a.employeeColor || "#10b981"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-200">{a.employeeName}</div>
                      <div className="truncate text-xs text-zinc-500">{a.toolDisplayName}</div>
                    </div>
                    <ApprovalStatusBadge status={a.status} />
                  </div>
                  {/* Contract header in list */}
                  {a.contract && (
                    <div className="flex items-center gap-2 text-[0.65rem] text-zinc-500">
                      <span className="font-mono text-emerald-400">{a.contract.contractNumber}</span>
                      <span>v{a.contract.version}</span>
                      <span>·</span>
                      <span>{(a.contract.confidence * 100).toFixed(0)}% confidence</span>
                    </div>
                  )}
                  <div className="line-clamp-1 text-xs text-zinc-400">{a.taskTitle}</div>
                  <div className="flex items-center gap-2 text-[0.65rem] text-zinc-500">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(a.createdAt)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div className="lg:col-span-3">
            {selected && !showModify && (
              <DecisionDetail
                approval={selected}
                onApprove={() => approveMutation.mutate({ id: selected.id })}
                onReject={() => rejectMutation.mutate({ id: selected.id })}
                onModify={() => setShowModify(true)}
                isApproving={approveMutation.isPending}
                isRejecting={rejectMutation.isPending}
              />
            )}
            {selected && showModify && (
              <ModifyPanel
                approval={selected}
                onCancel={() => setShowModify(false)}
                onSubmit={(modifiedAction: string) => {
                  // Send the modified action as a dedicated field.
                  // The backend creates Execution Contract V2 with this edit,
                  // preserves V1 permanently, and emits a human_override
                  // profile event so the employee's trust score reflects the
                  // manager's correction.
                  approveMutation.mutate({ id: selected.id, modifiedAction });
                  setShowModify(false);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Decision Detail ─────────────────────────────────────────────────────────

function DecisionDetail({
  approval,
  onApprove,
  onReject,
  onModify,
  isApproving,
  isRejecting,
}: {
  approval: any;
  onApprove: () => void;
  onReject: () => void;
  onModify: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const contract = approval.contract;
  const proposedAction = approval.proposedAction;

  // Extract finance reasoning from proposedAction (stored by the Finance Brain)
  const why = proposedAction.why || proposedAction.businessReason || "";
  const evidence = proposedAction.evidence ? (typeof proposedAction.evidence === "string" ? JSON.parse(proposedAction.evidence) : proposedAction.evidence) : (contract?.evidence || []);
  const policiesUsed = proposedAction.policyInfluence ? (typeof proposedAction.policyInfluence === "string" ? JSON.parse(proposedAction.policyInfluence) : proposedAction.policyInfluence) : (contract?.policiesUsed || []);
  const rejectedAlternatives = proposedAction.rejectedAlternatives ? (typeof proposedAction.rejectedAlternatives === "string" ? JSON.parse(proposedAction.rejectedAlternatives) : proposedAction.rejectedAlternatives) : [];
  const riskAssessment = proposedAction.riskAssessment || "";
  const customerHistoryInfluence = proposedAction.customerHistoryInfluence || "";

  // Context fields from proposedAction
  const invoiceNumber = proposedAction.invoiceNumber || "";
  const customerName = proposedAction.customerName || "";
  const outstanding = proposedAction.outstanding || "";
  const daysOverdue = proposedAction.daysOverdue || "";
  const agingBucket = proposedAction.agingBucket || "";
  const collectionPriority = proposedAction.collectionPriority || "";
  const recommendedAction = proposedAction.recommendedAction || proposedAction.action || "";

  const confidence = contract?.confidence ?? parseFloat(proposedAction.confidence || "0.85");

  return (
    <div className="space-y-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">

      {/* ─── 1. Contract Header ─── */}
      <div className="border-b border-zinc-800 bg-zinc-900/80 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {contract && (
                <span className="font-mono text-sm font-bold text-emerald-400">{contract.contractNumber}</span>
              )}
              {contract && <span className="text-xs text-zinc-500">v{contract.version}</span>}
              <ApprovalStatusBadge status={approval.status} />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Avatar name={approval.employeeName} color={approval.employeeColor || "#10b981"} size="md" />
              <div>
                <div className="text-sm font-semibold text-zinc-100">{approval.employeeName}</div>
                <div className="text-xs text-zinc-500">{approval.toolDisplayName}</div>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            {/* Confidence */}
            <div className="mb-2">
              <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">Confidence</div>
              <div className="text-lg font-bold" style={{ color: confidence >= 0.85 ? "#10b981" : confidence >= 0.7 ? "#f59e0b" : "#ef4444" }}>
                {(confidence * 100).toFixed(0)}%
              </div>
            </div>
            {/* Risk */}
            <div>
              <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">Risk</div>
              <div className="flex items-center justify-end gap-1">
                <AlertTriangle className={cn("h-3.5 w-3.5", approval.riskScore >= 70 ? "text-red-400" : approval.riskScore >= 40 ? "text-amber-400" : "text-emerald-400")} />
                <span className="text-sm font-bold" style={{ color: approval.riskScore >= 70 ? "#ef4444" : approval.riskScore >= 40 ? "#f59e0b" : "#10b981" }}>
                  {approval.riskScore}
                </span>
              </div>
            </div>
          </div>
        </div>
        {contract && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.65rem] text-zinc-500">
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {formatHash(contract.contractHash)}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Generated {formatDateTime(contract.generatedAt)}
            </span>
          </div>
        )}
      </div>

      {/* ─── 2. Context ─── */}
      {(invoiceNumber || customerName) && (
        <div className="border-b border-zinc-800 p-5">
          <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Context</div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {customerName && (
              <ContextField label="Customer" value={customerName} />
            )}
            {invoiceNumber && (
              <ContextField label="Invoice" value={invoiceNumber} mono />
            )}
            {outstanding && (
              <ContextField label="Outstanding" value={formatINR(outstanding)} />
            )}
            {daysOverdue && (
              <ContextField label="Days Overdue" value={String(daysOverdue)} />
            )}
            {agingBucket && (
              <ContextField label="Aging" value={agingBucket.replace(/_/g, " ")} />
            )}
            {collectionPriority && (
              <ContextField label="Priority" value={collectionPriority.toUpperCase()} />
            )}
          </div>
        </div>
      )}

      {/* ─── 3. Why Section ─── */}
      {why && (
        <div className="border-b border-zinc-800 p-5">
          <div className="mb-3 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
            <Activity className="h-3.5 w-3.5" /> Why This Action
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{why}</p>
          {customerHistoryInfluence && (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">Customer History Influence</div>
              <p className="text-xs leading-relaxed text-zinc-400">{customerHistoryInfluence}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── 4. Evidence Section ─── */}
      {evidence.length > 0 && (
        <div className="border-b border-zinc-800 p-5">
          <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
            Evidence ({evidence.length} items)
          </div>
          <div className="space-y-4">
            {EVIDENCE_GROUPS.map((group) => {
              const items = evidence.filter((e: any) =>
                e.source === group.key ||
                (group.key === "policy" && e.source === "policy") ||
                (group.key === "human_feedback" && (e.source === "human_feedback" || e.fact?.includes("[MEMORY")))
              );
              if (items.length === 0) return null;
              const Icon = group.icon;
              return (
                <div key={group.key}>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                    <Icon className="h-3.5 w-3.5 text-zinc-500" />
                    {group.label}
                    <span className="text-zinc-600">({items.length})</span>
                  </div>
                  <div className="space-y-1.5 pl-5">
                    {items.map((e: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className={cn(
                          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                          e.weight === "high" ? "bg-red-400" : e.weight === "medium" ? "bg-amber-400" : "bg-zinc-500"
                        )} />
                        <span className="leading-relaxed text-zinc-400">{e.fact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 5. Business Impact ─── */}
      {(riskAssessment || contract?.businessImpact || approval.businessImpact) && (
        <div className="border-b border-zinc-800 p-5">
          <div className="mb-3 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
            <AlertTriangle className="h-3.5 w-3.5" /> Business Impact
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">
            {riskAssessment || contract?.businessImpact || approval.businessImpact}
          </p>
        </div>
      )}

      {/* ─── 6. Rollback Plan ─── */}
      {contract?.rollbackPlan && (
        <div className="border-b border-zinc-800 p-5">
          <div className="mb-3 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
            <RotateCcw className="h-3.5 w-3.5" /> Rollback Plan
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">{contract.rollbackPlan}</p>
        </div>
      )}

      {/* ─── 7. Estimated Outcome ─── */}
      {contract?.estimatedBusinessOutcome && (
        <div className="border-b border-zinc-800 p-5">
          <div className="mb-3 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
            <TrendingUp className="h-3.5 w-3.5" /> Estimated Outcome
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">{contract.estimatedBusinessOutcome}</p>
        </div>
      )}

      {/* ─── 8. Execution Preview ─── */}
      <div className="border-b border-zinc-800 p-5">
        <div className="mb-3 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
          <Eye className="h-3.5 w-3.5" /> Execution Preview
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          {proposedAction.to && (
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className="text-zinc-500">To:</span>
              <span className="font-medium text-zinc-200">{proposedAction.to}</span>
            </div>
          )}
          {proposedAction.subject && (
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className="text-zinc-500">Subject:</span>
              <span className="font-medium text-zinc-200">{proposedAction.subject}</span>
            </div>
          )}
          {proposedAction.body && (
            <div className="mt-3 border-t border-zinc-800 pt-3">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">{proposedAction.body}</p>
            </div>
          )}
          {contract?.affectedSystems && contract.affectedSystems.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-800 pt-3">
              <span className="text-[0.6rem] text-zinc-500">Affected systems:</span>
              {contract.affectedSystems.map((s: string) => (
                <span key={s} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.6rem] text-zinc-400">{s}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Employee Profile Summary ─── */}
      {approval.profile && (
        <div className="border-b border-zinc-800 p-5">
          <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Employee Profile</div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ProfileField label="Level" value={`Lv${approval.profile.level}`} sub={approval.profile.title} />
            <ProfileField label="Trust" value={`${approval.profile.trustScore.toFixed(1)}`} sub="/ 100" />
            <ProfileField label="XP" value={String(approval.profile.experiencePoints)} sub="experience" />
            <ProfileField label="Tasks" value={`${approval.profile.completedTasks}`} sub={`${approval.profile.failedTasks} failed`} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ProfileField label="Approval Rate" value={`${(approval.profile.approvalRate * 100).toFixed(0)}%`} />
            <ProfileField label="Emails Sent" value={String(approval.profile.emailsSent)} />
            <ProfileField label="Tasks Automated" value={String(approval.profile.tasksAutomated)} />
            <ProfileField label="Hours Saved" value={`${approval.profile.hoursSaved.toFixed(1)}h`} />
          </div>
          {approval.profile.estimatedBusinessValue > 0 && (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <span className="text-xs text-zinc-500">Estimated Business Value: </span>
              <span className="text-sm font-bold text-emerald-400">
                ₹{((approval.profile.estimatedBusinessValue / 100) / 100000).toFixed(2)} L
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── Capability Status ─── */}
      {approval.capability && (
        <div className="border-b border-zinc-800 p-5">
          <div className="mb-3 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Required Capability
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-zinc-200">{approval.capability.required}</span>
                {approval.capability.granted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.6rem] font-bold text-emerald-400">
                    <Check className="h-2.5 w-2.5" /> GRANTED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[0.6rem] font-bold text-red-400">
                    <X className="h-2.5 w-2.5" /> MISSING
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-zinc-500">{approval.capability.name}</div>
              {!approval.capability.granted && (
                <div className="mt-2 flex items-start gap-1.5 rounded border border-red-500/20 bg-red-500/5 p-2">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
                  <p className="text-[0.7rem] leading-relaxed text-red-300">
                    {approval.capability.reason}. Execution is disabled until this capability is granted.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 9. Rejected Alternatives ─── */}
      {rejectedAlternatives.length > 0 && (
        <div className="border-b border-zinc-800 p-5">
          <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
            Rejected Alternatives ({rejectedAlternatives.length})
          </div>
          <div className="space-y-2">
            {rejectedAlternatives.slice(0, 5).map((alt: any, i: number) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5">
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-zinc-300">{alt.action?.replace(/_/g, " ")}</span>
                  <p className="text-xs leading-relaxed text-zinc-500">{alt.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 10. Timeline ─── */}
      {contract && (
        <div className="border-b border-zinc-800 p-5">
          <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Timeline</div>
          <div className="space-y-2">
            <TimelineItem
              icon={FileText}
              label="Contract Generated"
              time={contract.generatedAt}
              detail={`${contract.contractNumber} v${contract.version}`}
              done
            />
            {contract.parentContractId && (
              <TimelineItem
                icon={Edit3}
                label="Modified"
                time={contract.generatedAt}
                detail={`Version ${contract.version} created from v${contract.version - 1}`}
                done
              />
            )}
            {approval.status === "approved" && (
              <TimelineItem
                icon={Check}
                label="Approved"
                time={approval.decidedAt}
                detail={`Contract became immutable`}
                done
              />
            )}
            {approval.status === "rejected" && (
              <TimelineItem
                icon={X}
                label="Rejected"
                time={approval.decidedAt}
                detail={approval.reason || "No reason provided"}
                done
              />
            )}
            {approval.status === "approved" && (
              <TimelineItem
                icon={Activity}
                label="Executed"
                time={approval.decidedAt}
                detail={`${approval.toolDisplayName} completed`}
                done
              />
            )}
            {approval.status === "approved" && (
              <TimelineItem
                icon={FileCheck}
                label="Audit Recorded"
                time={approval.decidedAt}
                detail={`Hash ${formatHash(contract.contractHash)} in audit chain`}
                done
              />
            )}
            {approval.status === "pending" && (
              <>
                <TimelineItem icon={Check} label="Approved" time={null} detail="Awaiting your decision" done={false} />
                <TimelineItem icon={Activity} label="Executed" time={null} detail="" done={false} />
                <TimelineItem icon={FileCheck} label="Audit Recorded" time={null} detail="" done={false} />
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── 11. Actions ─── */}
      {approval.status === "pending" && (
        <div className="p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onApprove}
              disabled={isApproving || isRejecting || (approval.capability && !approval.capability.granted)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> {isApproving ? "Approving…" : "Approve"}
            </button>
            <button
              onClick={onModify}
              disabled={isApproving || isRejecting || (approval.capability && !approval.capability.granted)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              <Edit3 className="h-4 w-4" /> Modify
            </button>
            <button
              onClick={onReject}
              disabled={isApproving || isRejecting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            >
              <X className="h-4 w-4" /> {isRejecting ? "Rejecting…" : "Reject"}
            </button>
          </div>
          <p className="mt-3 flex items-center justify-center gap-1 text-xs text-zinc-500">
            <Lock className="h-3 w-3" />
            The employee is paused until you decide
          </p>
        </div>
      )}

      {/* Decision result (for history items) */}
      {approval.decision && (
        <div className="p-5">
          <div className="flex items-center gap-2">
            <ApprovalStatusBadge status={approval.status} />
            <span className="text-sm text-zinc-300">by {approval.decidedByName || "Manager"}</span>
            <span className="text-xs text-zinc-500">· {formatDateTime(approval.decidedAt)}</span>
          </div>
          {approval.reason && (
            <p className="mt-2 rounded-lg bg-zinc-800/50 p-3 text-sm text-zinc-400">
              <span className="font-medium text-zinc-300">Reason: </span>{approval.reason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Context Field ───────────────────────────────────────────────────────────

function ContextField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={cn("mt-0.5 text-sm font-medium text-zinc-200", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function ProfileField({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-sm font-bold text-zinc-100">{value}</span>
        {sub && <span className="text-[0.6rem] text-zinc-500">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Timeline Item ───────────────────────────────────────────────────────────

function TimelineItem({
  icon: Icon,
  label,
  time,
  detail,
  done,
}: {
  icon: typeof Check;
  label: string;
  time: Date | string | null;
  detail: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
        done ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-600"
      )}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium", done ? "text-zinc-200" : "text-zinc-500")}>{label}</span>
          {time && <span className="text-[0.65rem] text-zinc-500">{formatDateTime(time)}</span>}
        </div>
        {detail && <p className="text-[0.65rem] text-zinc-500">{detail}</p>}
      </div>
    </div>
  );
}

// ─── Modify Panel ────────────────────────────────────────────────────────────

function ModifyPanel({
  approval,
  onCancel,
  onSubmit,
}: {
  approval: any;
  onCancel: () => void;
  onSubmit: (modifiedAction: string) => void;
}) {
  const [instructions, setInstructions] = useState("");
  const proposedAction = approval.proposedAction;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="border-b border-zinc-800 p-5">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Modify Execution</h3>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Editing creates Execution Contract V2. V1 is preserved permanently.
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Modified instructions for the AI Employee</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            placeholder="e.g., Change the email tone to be more conciliatory. Offer a payment plan instead of demanding immediate payment. Reference the customer's 8-year relationship."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          />
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <div className="text-xs text-zinc-400">
              <span className="font-medium text-amber-400">V1 Contract Preserved.</span>{" "}
              The original contract (V1) remains permanently searchable.
              Your modification creates V2 with a new hash.
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-800 p-5">
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
        <button
          onClick={() => onSubmit(instructions)}
          disabled={!instructions.trim()}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          Submit V2
        </button>
      </div>
    </div>
  );
}

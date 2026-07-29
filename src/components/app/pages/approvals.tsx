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
  ListSkeleton,
  RiskScoreGauge,
  ConfidenceBar,
  BusinessImpactBlock,
  PolicyBadge,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Check,
  X,
  Edit3,
  Lock,
  Mail,
  Clock,
  History,
  Inbox,
} from "lucide-react";

export function ApprovalsPage() {
  const { navigate } = useRouter();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["approvals", "pending"],
    queryFn: () => api.approvals.pending(),
  });
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["approvals", "history"],
    queryFn: () => api.approvals.list("all"),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.approvals.approve(id, reason),
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

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        description={
          pending.length > 0
            ? `${pending.length} actions waiting for your review`
            : "All caught up — no pending approvals"
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
          title={tab === "pending" ? "No pending approvals" : "No approval history yet"}
          description={tab === "pending" ? "AI Employees are working. Approvals will appear here when critical actions are proposed." : "Decided approvals will appear here."}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* List */}
          <div className="space-y-2 lg:col-span-2">
            {list.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition-all",
                  selected?.id === a.id
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={a.employeeName} color="#10b981" size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-200">{a.employeeName}</div>
                    <div className="truncate text-xs text-zinc-500">{a.toolDisplayName}</div>
                  </div>
                  <ApprovalStatusBadge status={a.status} />
                </div>
                <div className="line-clamp-1 text-xs text-zinc-400">{a.taskTitle}</div>
                <div className="flex items-center gap-2 text-[0.65rem] text-zinc-500">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(a.createdAt)}
                  <span>·</span>
                  <CriticalityBadge criticality={a.criticality} />
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="lg:col-span-3">
            {selected && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
                {/* Header */}
                <div className="border-b border-zinc-800 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={selected.employeeName} color="#10b981" size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100">{selected.employeeName}</span>
                        <ApprovalStatusBadge status={selected.status} />
                      </div>
                      <div className="text-xs text-zinc-500">
                        requests approval to <span className="font-medium text-zinc-300">{selected.toolDisplayName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Created {formatDateTime(selected.createdAt)}</span>
                    <span>·</span>
                    <span>Timeout {formatDateTime(selected.timeoutAt)}</span>
                    <span>·</span>
                    <CriticalityBadge criticality={selected.criticality} />
                  </div>
                </div>

                {/* Task context */}
                <div className="border-b border-zinc-800 p-5">
                  <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Task</div>
                  <button
                    onClick={() => navigate("tasks")}
                    className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
                  >
                    {selected.taskTitle} →
                  </button>
                </div>

                {/* Risk Assessment */}
                <div className="border-b border-zinc-800 p-5">
                  <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Risk Assessment</div>
                  <div className="flex items-start gap-5">
                    <RiskScoreGauge score={selected.riskScore} size={72} />
                    <div className="min-w-0 flex-1 space-y-3">
                      <ConfidenceBar value={selected.confidence} label="AI Confidence" />
                      {selected.policyTrigger && (
                        <div className="flex items-center gap-2">
                          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Policy Trigger</span>
                          <PolicyBadge code={selected.policyTrigger.split(":")[0]} name={selected.policyTrigger.split(":")[1]?.trim()} />
                        </div>
                      )}
                    </div>
                  </div>
                  {selected.businessImpact && (
                    <div className="mt-4">
                      <BusinessImpactBlock text={selected.businessImpact} />
                    </div>
                  )}
                </div>

                {/* Original vs AI Comparison (for modified decisions) */}
                {selected.originalAction && selected.modifiedAction && (
                  <div className="border-b border-zinc-800 p-5">
                    <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Original vs Human-Modified</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                        <div className="mb-2 text-[0.6rem] font-semibold uppercase text-zinc-500">AI Original</div>
                        {selected.originalAction.body && <p className="text-xs leading-relaxed text-zinc-400 line-clamp-4">{selected.originalAction.body}</p>}
                      </div>
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                        <div className="mb-2 text-[0.6rem] font-semibold uppercase text-emerald-400">Human Modified</div>
                        {selected.modifiedAction.body && <p className="text-xs leading-relaxed text-zinc-300 line-clamp-4">{selected.modifiedAction.body}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Proposed action */}
                <div className="border-b border-zinc-800 p-5">
                  <div className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
                    <Mail className="h-3.5 w-3.5" /> Proposed Action {selected.originalAction && <span className="text-emerald-400">(edited)</span>}
                  </div>
                  {selected.proposedAction.to && (
                    <div className="mb-3">
                      <span className="text-xs text-zinc-500">To: </span>
                      <span className="text-sm text-zinc-200">{selected.proposedAction.to}</span>
                    </div>
                  )}
                  {selected.proposedAction.subject && (
                    <div className="mb-3">
                      <span className="text-xs text-zinc-500">Subject: </span>
                      <span className="text-sm text-zinc-200">{selected.proposedAction.subject}</span>
                    </div>
                  )}
                  {selected.proposedAction.body && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                      <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">{selected.proposedAction.body}</p>
                    </div>
                  )}
                </div>

                {/* Decision (if already decided) */}
                {selected.decision && (
                  <div className="border-b border-zinc-800 p-5">
                    <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Decision</div>
                    <div className="flex items-center gap-2">
                      <ApprovalStatusBadge status={selected.status} />
                      <span className="text-sm text-zinc-300">by {selected.decidedBy}</span>
                      <span className="text-xs text-zinc-500">· {formatDateTime(selected.decidedAt!)}</span>
                    </div>
                    {selected.reason && (
                      <p className="mt-2 rounded-lg bg-zinc-800/50 p-3 text-sm text-zinc-400">
                        <span className="font-medium text-zinc-300">Reason: </span>{selected.reason}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                {selected.status === "pending" && (
                  <div className="p-5">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={() => approveMutation.mutate({ id: selected.id })}
                        disabled={approveMutation.isPending}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> {approveMutation.isPending ? "Approving…" : "Approve"}
                      </button>
                      <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-800">
                        <Edit3 className="h-4 w-4" /> Modify
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate({ id: selected.id })}
                        disabled={rejectMutation.isPending}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" /> {rejectMutation.isPending ? "Rejecting…" : "Reject"}
                      </button>
                    </div>
                    <p className="mt-3 flex items-center justify-center gap-1 text-xs text-zinc-500">
                      <Lock className="h-3 w-3" />
                      The employee is paused until you decide
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

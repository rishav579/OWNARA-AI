"use client";

import { useState } from "react";
import { useRouter, formatRelativeTime, formatDateTime } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  PageHeader,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ConfidenceBar,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  Send,
  ArrowRight,
  XCircle,
  Loader2,
  Inbox,
  AlertOctagon,
  Bell,
  TrendingUp,
  Lightbulb,
  ShieldAlert,
  FileText,
  Users,
  Bot,
  ChevronRight,
  Reply,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Communication {
  id: string;
  threadId: string | null;
  senderEmployeeId: string | null;
  senderUserId: string | null;
  senderName: string;
  senderType: string;
  receiverType: string;
  receiverEmployeeId: string | null;
  receiverUserId: string | null;
  receiverName: string;
  communicationType: string;
  priority: string;
  subject: string;
  summary: string;
  explanation: string;
  relatedTaskId: string | null;
  relatedContractId: string | null;
  relatedCustomerId: string | null;
  relatedInvoiceId: string | null;
  relatedApprovalId: string | null;
  whyExists: string;
  evidence: Array<{ source: string; fact: string; weight: string }>;
  confidence: number;
  businessImpact: string;
  recommendedAction: string;
  expectedOutcome: string;
  attachments: Array<{ type: string; label: string; ref: string }>;
  actionButtons: Array<{ label: string; action: string; style: string }>;
  status: string;
  qualityScore: number;
  isDuplicate: boolean;
  isThrottled: boolean;
  createdAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  escalatedAt: string | null;
  responseTimeMs: number | null;
  responseAction: string | null;
}

// ─── Communication Type Config ───────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  notification:           { icon: Bell,           color: "text-sky-400",     bg: "bg-sky-500/10" },
  recommendation:         { icon: Lightbulb,      color: "text-violet-400",  bg: "bg-violet-500/10" },
  escalation:             { icon: AlertOctagon,   color: "text-red-400",     bg: "bg-red-500/10" },
  clarification_request:  { icon: HelpCircle,     color: "text-amber-400",   bg: "bg-amber-500/10" },
  information_request:    { icon: FileText,       color: "text-sky-400",     bg: "bg-sky-500/10" },
  approval_request:       { icon: ShieldAlert,    color: "text-amber-400",   bg: "bg-amber-500/10" },
  coordination_message:   { icon: Users,          color: "text-emerald-400", bg: "bg-emerald-500/10" },
  status_update:          { icon: TrendingUp,     color: "text-zinc-400",    bg: "bg-zinc-500/10" },
  completion_report:      { icon: CheckCircle2,   color: "text-emerald-400", bg: "bg-emerald-500/10" },
  warning:                { icon: AlertTriangle,  color: "text-amber-400",   bg: "bg-amber-500/10" },
  critical_alert:         { icon: AlertOctagon,   color: "text-red-400",     bg: "bg-red-500/10" },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  low:      { color: "text-zinc-400",    label: "Low" },
  medium:   { color: "text-sky-400",     label: "Medium" },
  high:     { color: "text-amber-400",   label: "High" },
  critical: { color: "text-red-400",     label: "Critical" },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  sent:         { color: "text-sky-400",     label: "Unread" },
  delivered:    { color: "text-sky-400",     label: "Unread" },
  read:         { color: "text-zinc-400",    label: "Read" },
  acknowledged: { color: "text-amber-400",   label: "Waiting" },
  resolved:     { color: "text-emerald-400", label: "Resolved" },
  ignored:      { color: "text-zinc-500",    label: "Ignored" },
  escalated:    { color: "text-red-400",     label: "Escalated" },
};

const TABS = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "unread", label: "Unread", icon: Mail },
  { id: "critical", label: "Critical", icon: AlertOctagon },
  { id: "waiting", label: "Waiting", icon: Clock },
  { id: "resolved", label: "Resolved", icon: CheckCircle2 },
] as const;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "by_employee", label: "By Employee" },
  { id: "by_customer", label: "By Customer" },
  { id: "by_task", label: "By Task" },
] as const;

// ─── Main Page ───────────────────────────────────────────────────────────────

export function CommunicationPage() {
  const { navigate } = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("inbox");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ─── Queries ──────────────────────────────────────────────────────────────
  const statusParam = tab === "unread" ? "sent" : tab === "critical" ? "all" : tab === "waiting" ? "acknowledged" : tab === "resolved" ? "resolved" : "all";
  const priorityParam = tab === "critical" ? "critical" : "all";

  const { data: communications = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["communications", tab, filter, search],
    queryFn: () => api.communications.list({
      status: statusParam,
      priority: priorityParam,
      search: search || undefined,
      limit: 100,
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ["communications", "stats"],
    queryFn: () => api.communications.stats(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.employees.list(),
  });

  // ─── Mutations ────────────────────────────────────────────────────────────
  const actionMutation = useMutation({
    mutationFn: ({ id, action, note, reason }: { id: string; action: string; note?: string; reason?: string }) =>
      api.communications.action(id, action, note, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communications"] });
    },
  });

  // ─── Filtered list for the "critical" tab (priority=critical + not resolved) ─
  const displayList = tab === "critical"
    ? communications.filter((c: Communication) => c.priority === "critical" && c.status !== "resolved" && c.status !== "ignored")
    : communications;

  const selected = selectedId ? displayList.find((c: Communication) => c.id === selectedId) : displayList[0];

  // ─── Loading / error ──────────────────────────────────────────────────────
  if (isLoading) return <ListSkeleton rows={6} />;
  if (isError) return <ErrorState message="Failed to load communications" cause="The server may be unreachable." action="Try refreshing the page." onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader
        title="Communication Center"
        description="Structured business communication from your AI Employees"
        actions={
          <button
            onClick={() => navigate("approvals")}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Decision Center</span>
          </button>
        }
      />

      {/* ─── Stats strip ─── */}
      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatChip label="Unread" value={stats.unread} icon={Mail} color="text-sky-400" />
          <StatChip label="Critical" value={stats.critical} icon={AlertOctagon} color="text-red-400" />
          <StatChip label="Waiting" value={stats.waiting} icon={Clock} color="text-amber-400" />
          <StatChip label="Resolved" value={stats.resolved} icon={CheckCircle2} color="text-emerald-400" />
          <StatChip label="Avg Response" value={stats.avgResponseTimeMs ? formatDuration(stats.avgResponseTimeMs) : "—"} icon={TrendingUp} color="text-zinc-400" />
        </div>
      )}

      {/* ─── Tabs + Search ─── */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === t.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search communications…"
            className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-xs text-zinc-200 outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="mb-4 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3 py-1 text-[0.65rem] font-medium transition-colors",
              filter === f.id ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ─── Two-column: list + detail ─── */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* List */}
        <div className="lg:col-span-2">
          {displayList.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No communications"
              description={tab === "unread" ? "You're all caught up." : "Communications from your AI Employees will appear here."}
            />
          ) : (
            <div className="max-h-[calc(100vh-300px)] space-y-2 overflow-y-auto">
              {displayList.map((c: Communication) => (
                <CommunicationListItem
                  key={c.id}
                  comm={c}
                  selected={selected?.id === c.id}
                  onClick={() => {
                    setSelectedId(c.id);
                    if (c.status === "sent" || c.status === "delivered") {
                      actionMutation.mutate({ id: c.id, action: "read" });
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          {selected ? (
            <CommunicationDetail
              comm={selected}
              onAction={(action, note, reason) => {
                actionMutation.mutate({ id: selected.id, action, note, reason });
              }}
              acting={actionMutation.isPending}
            />
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="Select a communication"
              description="Click a message to view its full details."
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatChip({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
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

function CommunicationListItem({ comm: c, selected, onClick }: { comm: Communication; selected: boolean; onClick: () => void }) {
  const typeConfig = TYPE_CONFIG[c.communicationType] || TYPE_CONFIG.notification;
  const Icon = typeConfig.icon;
  const priorityConfig = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.medium;
  const isUnread = c.status === "sent" || c.status === "delivered";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        selected ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700",
        isUnread && !selected && "border-l-2 border-l-emerald-500"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", typeConfig.bg)}>
          <Icon className={cn("h-3.5 w-3.5", typeConfig.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("truncate text-xs font-semibold", isUnread ? "text-zinc-100" : "text-zinc-400")}>
              {c.subject}
            </span>
            {c.priority === "critical" && (
              <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[0.55rem] font-bold text-red-400">
                CRITICAL
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[0.65rem] text-zinc-500">
            {c.senderName} → {c.receiverName}
          </div>
          <div className="mt-0.5 truncate text-[0.65rem] text-zinc-600">
            {c.summary}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[0.6rem] text-zinc-500">
            <span className={priorityConfig.color}>{priorityConfig.label}</span>
            <span>·</span>
            <span>{formatRelativeTime(c.createdAt)}</span>
            {c.responseTimeMs && (
              <>
                <span>·</span>
                <span className="text-emerald-400/70">replied in {formatDuration(c.responseTimeMs)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function CommunicationDetail({
  comm: c,
  onAction,
  acting,
}: {
  comm: Communication;
  onAction: (action: string, note?: string, reason?: string) => void;
  acting: boolean;
}) {
  const typeConfig = TYPE_CONFIG[c.communicationType] || TYPE_CONFIG.notification;
  const Icon = typeConfig.icon;
  const priorityConfig = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.medium;
  const statusConfig = STATUS_CONFIG[c.status] || STATUS_CONFIG.read;
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      {/* Header */}
      <div className="border-b border-zinc-800 p-5">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", typeConfig.bg)}>
            <Icon className={cn("h-5 w-5", typeConfig.color)} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-zinc-100">{c.subject}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-400">{c.senderName}</span>
              <ArrowRight className="h-3 w-3 text-zinc-600" />
              <span className="text-zinc-400">{c.receiverName}</span>
              <span className={cn("rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium", typeConfig.bg, typeConfig.color)}>
                {c.communicationType.replace(/_/g, " ")}
              </span>
              <span className={cn("rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium", priorityConfig.color)}>
                {priorityConfig.label}
              </span>
              <span className={cn("rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium", statusConfig.color)}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <div className="text-right text-[0.6rem] text-zinc-500">
            <div>{formatDateTime(c.createdAt)}</div>
            <div className="mt-0.5">Q{c.qualityScore}/100</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 p-5">
        {/* Summary */}
        <div>
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Summary</div>
          <p className="mt-1 text-sm text-zinc-200">{c.summary}</p>
        </div>

        {/* Explanation */}
        <div>
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Explanation</div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{c.explanation}</p>
        </div>

        {/* Explainability grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          <ExplainCell label="Why this exists" value={c.whyExists} />
          <ExplainCell label="Business impact" value={c.businessImpact} />
          <ExplainCell label="Recommended action" value={c.recommendedAction} />
          <ExplainCell label="Expected outcome" value={c.expectedOutcome} />
        </div>

        {/* Confidence */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Confidence</span>
            <span className="font-mono text-zinc-400">{(c.confidence * 100).toFixed(0)}%</span>
          </div>
          <ConfidenceBar value={c.confidence} />
        </div>

        {/* Evidence */}
        {c.evidence && c.evidence.length > 0 && (
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Evidence</div>
            <div className="mt-2 space-y-1.5">
              {c.evidence.map((e, idx) => (
                <div key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-300">{e.source}</span>
                    <span className="text-[0.6rem] text-zinc-500">{e.weight}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400">{e.fact}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business context */}
        {(c.relatedTaskId || c.relatedCustomerId || c.relatedInvoiceId || c.relatedApprovalId || c.relatedContractId) && (
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Business Context</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.relatedTaskId && <ContextChip label="Task" refId={c.relatedTaskId} />}
              {c.relatedCustomerId && <ContextChip label="Customer" refId={c.relatedCustomerId} />}
              {c.relatedInvoiceId && <ContextChip label="Invoice" refId={c.relatedInvoiceId} />}
              {c.relatedApprovalId && <ContextChip label="Approval" refId={c.relatedApprovalId} />}
              {c.relatedContractId && <ContextChip label="Contract" refId={c.relatedContractId} />}
            </div>
          </div>
        )}

        {/* Scoring flags */}
        {(c.isDuplicate || c.isThrottled) && (
          <div className="flex gap-2">
            {c.isDuplicate && (
              <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[0.6rem] text-zinc-400">
                <AlertCircle className="h-3 w-3" /> Duplicate detected
              </span>
            )}
            {c.isThrottled && (
              <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[0.6rem] text-zinc-400">
                <AlertCircle className="h-3 w-3" /> Throttled
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 p-4">
        {c.status !== "resolved" && c.status !== "ignored" && (
          <>
            <button
              onClick={() => onAction("resolve", "Resolved from Communication Center")}
              disabled={acting}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
            >
              {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Resolve
            </button>
            <button
              onClick={() => onAction("acknowledge")}
              disabled={acting}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Acknowledge
            </button>
            <button
              onClick={() => onAction("escalate", undefined, "Escalated from Communication Center")}
              disabled={acting}
              className="flex items-center gap-1.5 rounded-lg border border-amber-700/50 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
            >
              <AlertOctagon className="h-3.5 w-3.5" />
              Escalate
            </button>
            <button
              onClick={() => onAction("ignore")}
              disabled={acting}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Ignore
            </button>
          </>
        )}
        {c.status === "resolved" && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Resolved {c.resolvedAt && `· ${formatRelativeTime(c.resolvedAt)}`}
          </div>
        )}
        {c.status === "ignored" && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <XCircle className="h-4 w-4" />
            Ignored
          </div>
        )}
        {c.responseTimeMs && (
          <span className="ml-auto text-[0.6rem] text-zinc-500">
            Response time: {formatDuration(c.responseTimeMs)}
          </span>
        )}
      </div>
    </div>
  );
}

function ExplainCell({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <p className="mt-1 text-xs text-zinc-300">{value}</p>
    </div>
  );
}

function ContextChip({ label, refId }: { label: string; refId: string }) {
  return (
    <span className="flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.6rem] text-zinc-400">
      {label}: {refId.slice(-8)}
    </span>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return "<1s";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

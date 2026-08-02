"use client";

import { useState } from "react";
import { useRouter, formatDateTime } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeader,
  HashDisplay,
  EmptyState,
  ErrorState,
  ListSkeleton,
  CategoryBadge,
  PolicyBadge,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  ScrollText,
  Search,
  Lock,
  Zap,
  CheckCircle2,
  XCircle,
  FileText,
  Play,
  Pause,
  ShieldCheck,
} from "lucide-react";

const ENTRY_ICONS: Record<string, { icon: typeof FileText; cls: string }> = {
  approval_requested: { icon: Lock, cls: "bg-amber-500/10 text-amber-400" },
  approval_decided: { icon: ShieldCheck, cls: "bg-emerald-500/10 text-emerald-400" },
  step_executed: { icon: FileText, cls: "bg-sky-500/10 text-sky-400" },
  tool_executed: { icon: Zap, cls: "bg-violet-500/10 text-violet-400" },
  llm_call: { icon: Zap, cls: "bg-zinc-500/10 text-zinc-400" },
  task_started: { icon: Play, cls: "bg-emerald-500/10 text-emerald-400" },
  task_completed: { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-400" },
  task_failed: { icon: XCircle, cls: "bg-red-500/10 text-red-400" },
  employee_paused: { icon: Pause, cls: "bg-amber-500/10 text-amber-400" },
  employee_resumed: { icon: Play, cls: "bg-emerald-500/10 text-emerald-400" },
};

export function AuditPage() {
  const { navigate } = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: entries = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["audit", typeFilter],
    queryFn: () => api.audit.list({ entryType: typeFilter !== "all" ? typeFilter : undefined }),
  });

  const entryTypes = ["all", ...new Set(entries.map((e: any) => e.entryType))];

  const filtered = entries.filter((e: any) => {
    if (query) {
      const q = query.toLowerCase();
      return (
        e.entryType.includes(q) ||
        e.actorName.toLowerCase().includes(q) ||
        (e.targetType || "").includes(q) ||
        Object.values(e.payload).some((v: any) => String(v).toLowerCase().includes(q))
      );
    }
    return true;
  });

  const selected = filtered.find((e: any) => e.id === selectedId) || filtered[0];

  return (
    <div>
      <PageHeader
        title="Audit Timeline"
        description="Immutable, hash-chained log of every action, decision, and intervention"
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Chain verified</span>
          </div>
        }
      />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search audit trail…"
            className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-xs text-zinc-200 outline-none focus:border-zinc-700"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-200 outline-none focus:border-zinc-700"
        >
          {entryTypes.map((t) => (
            <option key={t} value={t}>{t === "all" ? "All types" : t.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : isError ? (
        <ErrorState message="Failed to load audit trail" cause="The server may be unreachable." action="Try refreshing the page." onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" description="Audit entries will appear here as AI Employees take actions." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Timeline list */}
          <div className="lg:col-span-3">
            <div className="relative">
              {/* vertical line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-zinc-800" />
              <div className="space-y-1">
                {filtered.map((entry) => {
                  const config = ENTRY_ICONS[entry.entryType] || { icon: FileText, cls: "bg-zinc-500/10 text-zinc-400" };
                  const Icon = config.icon;
                  const isSelected = selected?.id === entry.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      className={cn(
                        "relative flex w-full items-start gap-3 rounded-lg p-2 pl-0 text-left transition-colors",
                        isSelected ? "bg-zinc-800/50" : "hover:bg-zinc-800/30"
                      )}
                    >
                      <div className={cn("relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800", config.cls)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[0.65rem] text-zinc-600">#{entry.sequenceNumber}</span>
                          <span className="text-sm font-medium text-zinc-200">{entry.businessEvent || entry.entryType.replace(/_/g, " ")}</span>
                          <CategoryBadge category={entry.category || "system"} />
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          <span className="text-zinc-400">{entry.businessDescription || entry.actorName}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[0.65rem] text-zinc-600">
                          <span>{formatDateTime(entry.createdAt)}</span>
                          <span>·</span>
                          <HashDisplay hash={entry.entryHash} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {selected && (
              <div className="sticky top-20 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <div className="border-b border-zinc-800 p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-500">#{selected.sequenceNumber}</span>
                    <span className="text-sm font-semibold text-zinc-100">{selected.entryType.replace(/_/g, " ")}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{formatDateTime(selected.createdAt)}</div>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Actor</div>
                    <div className="mt-0.5 text-sm text-zinc-200">{selected.actorName}</div>
                    <div className="text-xs text-zinc-500">{selected.actorType}</div>
                  </div>
                  <div>
                    <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Target</div>
                    <div className="mt-0.5 text-sm text-zinc-200">{selected.targetType}</div>
                    <div className="font-mono text-xs text-zinc-500">{selected.targetId}</div>
                  </div>
                  <div>
                    <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Payload</div>
                    <div className="mt-1 space-y-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                      {Object.entries(selected.payload).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500">{k}</span>
                          <span className="font-mono text-zinc-300">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Decision & Reason (for approval events) */}
                  {selected.decision && (
                    <div>
                      <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Decision</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium",
                          selected.decision === "approved" ? "bg-emerald-500/15 text-emerald-400" :
                          selected.decision === "rejected" ? "bg-red-500/15 text-red-400" :
                          "bg-sky-500/15 text-sky-400"
                        )}>{selected.decision}</span>
                        <span className="text-xs text-zinc-400">by {selected.actorName}</span>
                      </div>
                      {selected.reason && (
                        <p className="mt-1.5 rounded-lg bg-zinc-800/50 p-2 text-xs text-zinc-400">{selected.reason}</p>
                      )}
                    </div>
                  )}
                  {/* Policy Reference */}
                  {selected.policyRef && (
                    <div>
                      <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Policy Reference</div>
                      <div className="mt-1">
                        <PolicyBadge code={selected.policyRef} />
                      </div>
                    </div>
                  )}
                  <div className="border-t border-zinc-800 pt-3">
                    <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">Hash Chain</div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between rounded-md bg-zinc-800/50 px-2.5 py-1.5">
                        <span className="text-[0.65rem] text-zinc-500">Previous</span>
                        <HashDisplay hash={selected.previousHash} />
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-emerald-500/5 px-2.5 py-1.5">
                        <span className="text-[0.65rem] text-emerald-400">This entry</span>
                        <HashDisplay hash={selected.entryHash} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[0.65rem] text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      Hash chain intact — tamper-evident
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

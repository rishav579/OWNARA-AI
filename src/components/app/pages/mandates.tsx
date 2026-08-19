/**
 * OWNARA — Mandates List Page
 *
 * The fundamental primitive, visible. This is NOT a task list. Each card is a
 * PERSISTENT ORGANIZATIONAL RESPONSIBILITY entrusted to an AI tenant — a
 * declared desired state the tenant pursues continuously within granted authority.
 *
 * The user must immediately understand: "This is something I have entrusted to AI."
 */

"use client";

import { useRouter } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Scroll,
  Plus,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Activity,
  Clock,
  ArrowRight,
  Loader2,
} from "lucide-react";

const STATUS_STYLES: Record<string, { label: string; icon: typeof ShieldCheck; className: string }> = {
  active: { label: "Active", icon: Activity, className: "bg-emerald-500/15 text-emerald-400" },
  paused: { label: "Paused", icon: Clock, className: "bg-amber-500/15 text-amber-400" },
  proposed: { label: "Proposed", icon: Clock, className: "bg-zinc-500/15 text-zinc-400" },
  granted: { label: "Granted", icon: ShieldCheck, className: "bg-blue-500/15 text-blue-400" },
  resolved: { label: "Resolved", icon: ShieldCheck, className: "bg-teal-500/15 text-teal-400" },
  revoked: { label: "Revoked", icon: ShieldX, className: "bg-zinc-600/15 text-zinc-500" },
  breached: { label: "Breached", icon: ShieldAlert, className: "bg-red-500/15 text-red-400" },
};

function healthColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function healthBar(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export function MandatesPage() {
  const { navigate } = useRouter();
  const { data: mandates = [], isLoading } = useQuery({
    queryKey: ["mandates"],
    queryFn: () => api.mandates.list(),
    refetchInterval: 15000,
  });

  const activeCount = mandates.filter((m: any) => m.status === "active").length;
  const avgHealth =
    mandates.length > 0
      ? Math.round(mandates.reduce((s: number, m: any) => s + (m.healthScore || 0), 0) / mandates.length)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Mandates</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Persistent responsibilities entrusted to your AI workforce. Each Mandate pursues a desired state continuously — it is not a task.
          </p>
        </div>
        <button
          onClick={() => navigate("grant-mandate")}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" />
          Grant Mandate
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="text-xs text-zinc-500">Total Mandates</div>
          <div className="mt-1 text-2xl font-bold text-zinc-50">{mandates.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="text-xs text-zinc-500">Active</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">{activeCount}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="text-xs text-zinc-500">Avg Health</div>
          <div className={cn("mt-1 text-2xl font-bold", healthColor(avgHealth))}>{avgHealth}%</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="text-xs text-zinc-500">Pursuing State</div>
          <div className="mt-1 text-2xl font-bold text-zinc-50">24/7</div>
        </div>
      </div>

      {/* Mandate cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : mandates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
          <Scroll className="mx-auto mb-4 h-10 w-10 text-zinc-600" />
          <h3 className="text-lg font-semibold text-zinc-300">No Mandates yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            A Mandate is a persistent organizational responsibility you entrust to an AI employee.
            Unlike a task, it pursues a desired state continuously — and survives tenant replacement.
          </p>
          <button
            onClick={() => navigate("grant-mandate")}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            Grant your first Mandate
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {mandates.map((m: any) => {
            const status = STATUS_STYLES[m.status] || STATUS_STYLES.proposed;
            const StatusIcon = status.icon;
            return (
              <button
                key={m.id}
                onClick={() => navigate(`mandates/${m.id}`)}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900"
              >
                {/* Title + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-zinc-50">{m.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{m.declaration}</p>
                  </div>
                  <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold", status.className)}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                </div>

                {/* Health bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Desired-state health</span>
                    <span className={cn("font-bold", healthColor(m.healthScore))}>{Math.round(m.healthScore)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={cn("h-full rounded-full transition-all", healthBar(m.healthScore))}
                      style={{ width: `${m.healthScore}%` }}
                    />
                  </div>
                </div>

                {/* Footer: tenant + authority + tasks */}
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Tenant: <span className="font-medium text-zinc-300">{m.tenant?.name || "Unassigned"}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" />
                    {m._count?.tasks || 0} episodes
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {m.lastEvaluatedAt ? new Date(m.lastEvaluatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100">
                  View Mandate <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

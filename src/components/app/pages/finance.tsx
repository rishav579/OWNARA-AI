"use client";

import { useState } from "react";
import { useRouter } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeader,
  StatCard,
  ErrorState,
  ListSkeleton,
  TableSkeleton,
  EmptyState,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
  Users,
  Send,
  FileText,
  Briefcase,
  Receipt,
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: TrendingDown },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "cases", label: "Collection Cases", icon: Briefcase },
] as const;

function formatINR(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)} L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

export function FinancePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Accounts Receivable & Collections — powered by the AI Finance Employee"
      />

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-1 sm:w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "invoices" && <InvoicesTab />}
      {tab === "cases" && <CasesTab />}
    </div>
  );
}

function OverviewTab() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["finance-metrics"],
    queryFn: () => api.finance.metrics(),
  });

  if (isLoading) return <ListSkeleton rows={6} />;
  if (isError || !data) return <ErrorState message="Failed to load finance metrics" onRetry={() => refetch()} />;

  const agingBuckets = [
    { label: "Current", count: data.agingBuckets.current, amount: data.agingAmounts.current, color: "#10b981" },
    { label: "1–30 days", count: data.agingBuckets["1_30"], amount: data.agingAmounts["1_30"], color: "#f59e0b" },
    { label: "31–60 days", count: data.agingBuckets["31_60"], amount: data.agingAmounts["31_60"], color: "#f97316" },
    { label: "61–90 days", count: data.agingBuckets["61_90"], amount: data.agingAmounts["61_90"], color: "#ef4444" },
    { label: "90+ days", count: data.agingBuckets["90_plus"], amount: data.agingAmounts["90_plus"], color: "#991b1b" },
  ];
  const maxAgingAmount = Math.max(...agingBuckets.map((b) => b.amount), 1);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Outstanding AR" value={formatINR(data.outstandingReceivables)} icon={IndianRupee} accent="emerald" />
        <StatCard label="Overdue Invoices" value={String(data.overdueCount)} icon={Clock} accent="amber" />
        <StatCard label="Total Overdue" value={formatINR(data.totalOverdue)} icon={AlertTriangle} accent="amber" />
        <StatCard label="Customers at Risk" value={String(data.customersAtRisk)} icon={Users} accent="violet" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Recovered This Week" value={formatINR(data.recoveredThisWeek)} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Pending Follow-ups" value={String(data.pendingFollowups)} icon={Send} accent="sky" />
        <StatCard label="Avg Collection Time" value={`${data.avgCollectionTime}d`} icon={Clock} accent="violet" />
        <StatCard label="Open Cases" value={String(data.openCollectionCases)} icon={Briefcase} accent="amber" />
      </div>

      {/* Aging buckets */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-100">AR Aging Analysis</h3>
        <div className="space-y-3">
          {agingBuckets.map((b) => (
            <div key={b.label} className="flex items-center gap-4">
              <div className="w-28 shrink-0">
                <div className="text-sm font-medium text-zinc-200">{b.label}</div>
                <div className="text-xs text-zinc-500">{b.count} invoice(s)</div>
              </div>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-zinc-800">
                <div
                  className="flex h-full items-center justify-end rounded-md px-2 text-[0.6rem] font-bold text-white transition-all"
                  style={{ width: `${Math.max((b.amount / maxAgingAmount) * 100, 2)}%`, backgroundColor: b.color }}
                >
                  {b.amount > 0 && formatINR(b.amount)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-xs text-zinc-500">Total Customers</div>
          <div className="mt-1 text-2xl font-bold text-zinc-50">{data.totalCustomers}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-xs text-zinc-500">Total Invoices</div>
          <div className="mt-1 text-2xl font-bold text-zinc-50">{data.totalInvoices}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-xs text-zinc-500">Reminders Sent</div>
          <div className="mt-1 text-2xl font-bold text-zinc-50">{data.totalRemindersSent}</div>
        </div>
      </div>
    </div>
  );
}

function InvoicesTab() {
  const { data: invoices = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["finance-invoices"],
    queryFn: () => api.finance.invoices(),
  });

  if (isLoading) return <TableSkeleton rows={6} />;
  if (isError) return <ErrorState message="Failed to load invoices" onRetry={() => refetch()} />;

  const statusColors: Record<string, string> = {
    unpaid: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    partially_paid: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    overdue: "bg-red-500/15 text-red-400 border-red-500/30",
    written_off: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  };

  const agingColors: Record<string, string> = {
    current: "text-emerald-400",
    "1_30": "text-amber-400",
    "31_60": "text-orange-400",
    "61_90": "text-red-400",
    "90_plus": "text-red-600",
  };

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No invoices found"
        description="Upload invoices via the onboarding wizard to get started."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Invoice</th>
            <th className="hidden px-4 py-2.5 text-xs font-semibold text-zinc-400 sm:table-cell">Customer</th>
            <th className="hidden px-4 py-2.5 text-xs font-semibold text-zinc-400 md:table-cell">Due Date</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Outstanding</th>
            <th className="hidden px-4 py-2.5 text-xs font-semibold text-zinc-400 lg:table-cell">Aging</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {invoices.map((inv: any) => (
            <tr key={inv.id} className="transition-colors hover:bg-zinc-800/20">
              <td className="px-4 py-3">
                <div className="font-mono text-xs font-medium text-zinc-200">{inv.invoiceNumber}</div>
                <div className="text-[0.65rem] text-zinc-500">{inv.reminderCount} reminder(s)</div>
              </td>
              <td className="hidden px-4 py-3 sm:table-cell">
                <div className="text-sm text-zinc-200">{inv.customerName}</div>
                <div className={cn("text-[0.65rem]", inv.customerRiskLevel === "high" ? "text-red-400" : inv.customerRiskLevel === "medium" ? "text-amber-400" : "text-emerald-400")}>
                  {inv.customerRiskLevel} risk
                </div>
              </td>
              <td className="hidden px-4 py-3 text-xs text-zinc-400 md:table-cell">
                {new Date(inv.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                {inv.daysOverdue > 0 && (
                  <div className={cn("text-[0.65rem] font-medium", agingColors[inv.agingBucket])}>
                    {inv.daysOverdue}d overdue
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="text-sm font-semibold text-zinc-100">{formatINR(inv.outstanding)}</div>
                <div className="text-[0.65rem] text-zinc-500">of {formatINR(inv.total)}</div>
              </td>
              <td className="hidden px-4 py-3 lg:table-cell">
                <span className={cn("rounded px-1.5 py-0.5 text-[0.65rem] font-medium", agingColors[inv.agingBucket])}>
                  {inv.agingBucket === "current" ? "Current" : inv.agingBucket === "1_30" ? "1–30d" : inv.agingBucket === "31_60" ? "31–60d" : inv.agingBucket === "61_90" ? "61–90d" : "90+d"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", statusColors[inv.status] || statusColors.unpaid)}>
                  {inv.status.replace(/_/g, " ")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CasesTab() {
  const { data: cases = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["finance-cases"],
    queryFn: () => api.finance.collectionCases(),
  });

  if (isLoading) return <ListSkeleton rows={4} />;
  if (isError) return <ErrorState message="Failed to load collection cases" onRetry={() => refetch()} />;

  if (cases.length === 0) {
    return <EmptyState icon={Briefcase} title="No collection cases" description="Collection cases are created automatically when the Finance Employee processes overdue invoices." />;
  }

  const priorityColors: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/30",
    high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    medium: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    low: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };

  const statusColors: Record<string, string> = {
    open: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    escalated: "bg-red-500/15 text-red-400 border-red-500/30",
    resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    closed: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  };

  return (
    <div className="space-y-2">
      {cases.map((c: any) => (
        <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-zinc-200">{c.invoiceNumber}</span>
                <span className={cn("rounded-full border px-2 py-0.5 text-[0.65rem] font-medium", priorityColors[c.priority])}>
                  {c.priority}
                </span>
                <span className={cn("rounded-full border px-2 py-0.5 text-[0.65rem] font-medium", statusColors[c.status])}>
                  {c.status}
                </span>
              </div>
              <div className="mt-1 text-sm text-zinc-300">{c.customerName}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                <span>{formatINR(c.outstanding)} outstanding</span>
                <span>·</span>
                <span>{c.daysOverdue} days overdue</span>
                <span>·</span>
                <span>{c.followUpCount} follow-up(s)</span>
                {c.escalationLevel > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-red-400">Escalation level: {c.escalationLevel}</span>
                  </>
                )}
              </div>
              {c.lastFollowUp && (
                <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
                  <div className="text-[0.65rem] font-semibold uppercase text-zinc-500">Last Follow-up</div>
                  <div className="text-xs text-zinc-400">{c.lastFollowUp.description}</div>
                  <div className="text-[0.6rem] text-zinc-600">{new Date(c.lastFollowUp.performedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

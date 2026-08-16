"use client";

import { formatINR, formatNumber } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, ProgressBar, ErrorState, ListSkeleton } from "@/components/app/ui";
import { Zap, TrendingUp } from "lucide-react";

/**
 * Billing page — honest and minimal.
 * Shows real usage data from the billing API.
 * No fake "Update card", "Upgrade", "Contact sales" buttons.
 * No hardcoded dates.
 */
export function BillingPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["billing"],
    queryFn: () => api.billing.get(),
  });

  if (isLoading) return <ListSkeleton rows={4} />;
  if (isError || !data) return <ErrorState message="Failed to load billing" cause="The server may be unreachable." action="Try refreshing the page." onRetry={() => refetch()} />;

  const tokenPct = data.usage.tokensCap > 0 ? (data.usage.tokensUsed / data.usage.tokensCap) * 100 : 0;
  const costPct = data.usage.budgetCents > 0 ? (data.usage.costCents / data.usage.budgetCents) * 100 : 0;

  return (
    <div>
      <PageHeader title="Billing" description="Usage and spending" />

      <div className="max-w-2xl space-y-4">
        {/* Current spend */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">This Month</h3>
            <span className="text-2xl font-bold text-zinc-50">{formatINR(data.usage.costCents)}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Total API spending this billing period</p>
        </div>

        {/* Usage meters */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-zinc-100">API Usage</span>
              </div>
            </div>
            <div className="mt-3 mb-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-50">{formatNumber(data.usage.tokensUsed)}</span>
              <span className="text-sm text-zinc-500">/ {formatNumber(data.usage.tokensCap)}</span>
            </div>
            <ProgressBar value={data.usage.tokensUsed} max={data.usage.tokensCap} color="#10b981" />
            <div className="mt-2 text-xs text-zinc-500">{tokenPct.toFixed(1)}% used</div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-400" />
                <span className="text-sm font-semibold text-zinc-100">Spend</span>
              </div>
            </div>
            <div className="mt-3 mb-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-50">{formatINR(data.usage.costCents)}</span>
              <span className="text-sm text-zinc-500">/ {formatINR(data.usage.budgetCents)}</span>
            </div>
            <ProgressBar value={data.usage.costCents} max={data.usage.budgetCents} color="#0ea5e9" />
            <div className="mt-2 text-xs text-zinc-500">{costPct.toFixed(0)}% of budget</div>
          </div>
        </div>

        {/* Plans */}
        {data.plans && data.plans.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-zinc-100">Plan</h3>
            <div className="space-y-2">
              {data.plans.map((plan: any) => (
                <div key={plan.name} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{plan.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{plan.price}</span>
                    {plan.current && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.6rem] font-medium text-emerald-400">Current</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-zinc-600">
          Plan upgrades, payment methods, and invoice history will be available when payment integration is enabled.
        </p>
      </div>
    </div>
  );
}

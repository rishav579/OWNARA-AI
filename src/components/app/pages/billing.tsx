"use client";

import { useRouter, formatINR, formatNumber } from "@/lib/app/router";
import { DASHBOARD_STATS } from "@/lib/app/data";
import { PageHeader, ProgressBar } from "@/components/app/ui";
import {
  Zap,
  Check,
  CreditCard,
  Download,
  TrendingUp,
  Sparkles,
} from "lucide-react";

export function BillingPage() {
  const { navigate } = useRouter();
  const tokenPct = (DASHBOARD_STATS.tokens.usedThisMonth / 10000000) * 100;
  const costPct = (DASHBOARD_STATS.tokens.costCentsThisMonth / DASHBOARD_STATS.tokens.budgetCentsThisMonth) * 100;

  const invoices = [
    { id: "inv_jan28", date: "Jan 28, 2025", amount: 2596, status: "pending" },
    { id: "inv_jan15", date: "Jan 15, 2025", amount: 3120, status: "paid" },
    { id: "inv_jan01", date: "Jan 1, 2025", amount: 2890, status: "paid" },
    { id: "inv_dec15", date: "Dec 15, 2024", amount: 2450, status: "paid" },
  ];

  const plans = [
    {
      name: "Starter",
      price: "₹0",
      period: "/mo",
      desc: "For trying out AI Employees",
      features: ["1 AI Employee", "500K tokens / mo", "3 knowledge documents", "Community support"],
      current: false,
    },
    {
      name: "Pro",
      price: "₹4,999",
      period: "/mo",
      desc: "For small teams delegating real work",
      features: ["5 AI Employees", "10M tokens / mo", "Unlimited documents", "Email + chat support", "Audit trail export", "Priority approvals"],
      current: true,
    },
    {
      name: "Business",
      price: "₹19,999",
      period: "/mo",
      desc: "For growing operations",
      features: ["25 AI Employees", "50M tokens / mo", "Unlimited documents", "Priority support", "SSO (coming soon)", "Custom roles"],
      current: false,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Manage your plan, usage, and invoices"
        actions={
          <button className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Update card</span>
          </button>
        }
      />

      {/* Current plan */}
      <div className="mb-6 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-zinc-100">Pro Plan</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-400">Current</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">₹4,999 / month · renews on Feb 15, 2025</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-zinc-50">{formatINR(DASHBOARD_STATS.tokens.costCentsThisMonth)}</div>
            <div className="text-xs text-zinc-500">spent this month</div>
          </div>
        </div>
      </div>

      {/* Usage meters */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-zinc-100">Token Usage</span>
            </div>
            <span className="text-xs text-zinc-500">This month</span>
          </div>
          <div className="mt-3 mb-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-50">{formatNumber(DASHBOARD_STATS.tokens.usedThisMonth)}</span>
            <span className="text-sm text-zinc-500">/ 10M tokens</span>
          </div>
          <ProgressBar value={DASHBOARD_STATS.tokens.usedThisMonth} max={10000000} color="#10b981" />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-zinc-500">{tokenPct.toFixed(1)}% used</span>
            <span className="text-zinc-500">{(100 - tokenPct).toFixed(1)}% remaining</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-400" />
              <span className="text-sm font-semibold text-zinc-100">Spend</span>
            </div>
            <span className="text-xs text-zinc-500">vs ₹{DASHBOARD_STATS.tokens.budgetCentsThisMonth / 100} budget</span>
          </div>
          <div className="mt-3 mb-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-50">{formatINR(DASHBOARD_STATS.tokens.costCentsThisMonth)}</span>
            <span className="text-sm text-zinc-500">/ {formatINR(DASHBOARD_STATS.tokens.budgetCentsThisMonth)}</span>
          </div>
          <ProgressBar value={DASHBOARD_STATS.tokens.costCentsThisMonth} max={DASHBOARD_STATS.tokens.budgetCentsThisMonth} color="#0ea5e9" />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-zinc-500">{costPct.toFixed(0)}% of budget</span>
            <span className="text-emerald-400">Under budget</span>
          </div>
        </div>
      </div>

      {/* Plans */}
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">Available Plans</h3>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-5 ${
              plan.current ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-100">{plan.name}</h4>
              {plan.current && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.6rem] font-medium text-emerald-400">Current</span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-zinc-50">{plan.price}</span>
              <span className="text-sm text-zinc-500">{plan.period}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">{plan.desc}</p>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-zinc-300">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            {!plan.current && (
              <button className={`mt-5 w-full rounded-lg py-2 text-sm font-semibold transition-colors ${
                plan.name === "Business" ? "border border-zinc-700 text-zinc-200 hover:bg-zinc-800" : "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              }`}>
                {plan.name === "Business" ? "Contact sales" : "Upgrade"}
              </button>
            )}
            {plan.current && (
              <button className="mt-5 w-full rounded-lg border border-zinc-700 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800">
                Manage plan
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Invoices */}
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">Invoice History</h3>
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Invoice</th>
              <th className="hidden px-4 py-2.5 text-xs font-semibold text-zinc-400 sm:table-cell">Date</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Amount</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {invoices.map((inv) => (
              <tr key={inv.id} className="transition-colors hover:bg-zinc-800/20">
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">{inv.id}</td>
                <td className="hidden px-4 py-3 text-xs text-zinc-400 sm:table-cell">{inv.date}</td>
                <td className="px-4 py-3 text-sm font-medium text-zinc-200">{formatINR(inv.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    inv.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                  }`}>
                    {inv.status === "paid" ? "Paid" : "Due Feb 15"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-zinc-400 transition-colors hover:text-zinc-200">
                    <Download className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

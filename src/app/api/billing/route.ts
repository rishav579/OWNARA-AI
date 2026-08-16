import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);

    const llmUsage = await db.llmUsage.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const totalTokens = llmUsage.reduce((s, u) => s + u.totalTokens, 0);
    const totalCostCents = llmUsage.reduce((s, u) => s + u.costCents, 0);

    // Mock invoices (derived from usage)
    const invoices = [
      { id: "inv_jan28", date: "Jan 28, 2025", amount: 2596, status: "pending" },
      { id: "inv_jan15", date: "Jan 15, 2025", amount: 3120, status: "paid" },
      { id: "inv_jan01", date: "Jan 1, 2025", amount: 2890, status: "paid" },
      { id: "inv_dec15", date: "Dec 15, 2024", amount: 2450, status: "paid" },
    ];

    return success({
      currentPlan: {
        name: "Pro",
        price: 4999,
        period: "month",
        renewsOn: "Feb 15, 2025",
      },
      usage: {
        tokensUsed: totalTokens,
        tokensCap: 10000000,
        costCents: totalCostCents,
        budgetCents: 10000,
      },
      plans: [
        {
          name: "Starter",
          price: 0,
          period: "/mo",
          desc: "For trying out AI Employees",
          features: ["1 AI Employee", "500K tokens / mo", "3 knowledge documents", "Community support"],
          current: false,
        },
        {
          name: "Pro",
          price: 4999,
          period: "/mo",
          desc: "For small teams delegating real work",
          features: ["5 AI Employees", "10M tokens / mo", "Unlimited documents", "Email + chat support", "Audit trail export", "Priority approvals"],
          current: true,
        },
        {
          name: "Business",
          price: 19999,
          period: "/mo",
          desc: "For growing operations",
          features: ["25 AI Employees", "50M tokens / mo", "Unlimited documents", "Priority support", "SSO (coming soon)", "Custom roles"],
          current: false,
        },
      ],
      invoices,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

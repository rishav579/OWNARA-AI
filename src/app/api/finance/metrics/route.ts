import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";
import { calculateDaysOverdue, calculateAgingBucket } from "@/lib/finance/domain";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);

    const [invoices, customers, payments, reminders, collectionCases] = await Promise.all([
      db.invoice.findMany({
        where: { workspaceId },
        include: { customer: true, payments: { where: { status: "completed" } } },
      }),
      db.customer.findMany({ where: { workspaceId }, include: { invoices: true } }),
      db.payment.findMany({
        where: { workspaceId, status: "completed" },
        orderBy: { paymentDate: "desc" },
      }),
      db.reminder.findMany({ where: { workspaceId } }),
      db.collectionCase.findMany({ where: { workspaceId, status: { in: ["open", "escalated"] } } }),
    ]);

    // Calculate metrics from live data
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const outstandingReceivables = invoices.reduce((sum, inv) => sum + inv.outstanding, 0);

    const invoicesDueToday = invoices.filter((inv) => {
      const due = new Date(inv.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime() && inv.outstanding > 0;
    }).length;

    const overdueInvoices = invoices.filter((inv) => {
      const daysOverdue = calculateDaysOverdue(inv.dueDate);
      return daysOverdue > 0 && inv.outstanding > 0;
    });

    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.outstanding, 0);

    // Payments received this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const paymentsThisWeek = payments.filter((p) => new Date(p.paymentDate) >= weekAgo);
    const recoveredThisWeek = paymentsThisWeek.reduce((sum, p) => sum + p.amount, 0);

    // Total recovered (all-time)
    const totalRecovered = payments.reduce((sum, p) => sum + p.amount, 0);

    // Pending follow-ups: invoices with reminders drafted but not sent
    const pendingFollowups = reminders.filter((r) => r.status === "drafted").length;

    // Average collection time (days between issue date and payment date)
    let totalCollectionDays = 0;
    let paidCount = 0;
    for (const inv of invoices) {
      const completedPayments = inv.payments.filter((p) => p.status === "completed");
      if (completedPayments.length > 0) {
        const issueDate = new Date(inv.issueDate);
        const firstPayment = new Date(completedPayments[0].paymentDate);
        const diffDays = Math.floor((firstPayment.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          totalCollectionDays += diffDays;
          paidCount++;
        }
      }
    }
    const avgCollectionTime = paidCount > 0 ? Math.round(totalCollectionDays / paidCount) : 0;

    // Customers at risk: high risk level OR 2+ overdue invoices
    const customersAtRisk = customers.filter((c) => {
      if (c.riskLevel === "high") return true;
      const overdueCount = c.invoices.filter((inv) => {
        const daysOverdue = calculateDaysOverdue(inv.dueDate);
        return daysOverdue > 0 && inv.outstanding > 0;
      }).length;
      return overdueCount >= 2;
    }).length;

    // Aging buckets
    const agingBuckets = {
      current: 0,
      "1_30": 0,
      "31_60": 0,
      "61_90": 0,
      "90_plus": 0,
    };
    const agingAmounts = {
      current: 0,
      "1_30": 0,
      "31_60": 0,
      "61_90": 0,
      "90_plus": 0,
    };

    for (const inv of invoices) {
      if (inv.outstanding <= 0) continue;
      const daysOverdue = calculateDaysOverdue(inv.dueDate);
      const bucket = calculateAgingBucket(daysOverdue);
      agingBuckets[bucket as keyof typeof agingBuckets]++;
      agingAmounts[bucket as keyof typeof agingAmounts] += inv.outstanding;
    }

    // Open collection cases
    const openCollectionCases = collectionCases.length;
    const escalatedCases = collectionCases.filter((c) => c.status === "escalated").length;

    return success({
      outstandingReceivables,
      invoicesDueToday,
      overdueCount: overdueInvoices.length,
      totalOverdue,
      recoveredThisWeek,
      totalRecovered,
      pendingFollowups,
      avgCollectionTime,
      customersAtRisk,
      openCollectionCases,
      escalatedCases,
      totalCustomers: customers.length,
      totalInvoices: invoices.length,
      totalRemindersSent: reminders.filter((r) => r.status === "sent").length,
      agingBuckets,
      agingAmounts,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

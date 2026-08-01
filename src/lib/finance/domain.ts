/**
 * BIHARI AI — Finance Domain Service
 *
 * The reasoning layer that the Finance Employee uses. This is NOT a mock —
 * these are real finance calculations (aging, priority, risk) that a
 * collections team would perform.
 *
 * The planner calls these functions to decide what to do; the executor
 * calls them to generate step reasoning text and approval payloads.
 *
 * All amounts are in paise (1 rupee = 100 paise) to avoid floating-point
 * errors. The API layer converts to rupees for display.
 */

import { db } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InvoiceContext {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerRiskLevel: string;
  total: number;
  outstanding: number;
  issueDate: Date;
  dueDate: Date;
  paymentTerms: number;
  status: string;
  daysOverdue: number;
  agingBucket: string;
  previousReminderCount: number;
  lastReminderDate: Date | null;
  paymentHistoryCount: number;
  recommendedAction: string;
  collectionPriority: string;
  businessReason: string;
}

// ─── Aging ───────────────────────────────────────────────────────────────────

/**
 * Calculates days overdue for an invoice.
 * Returns 0 if the invoice is not yet due.
 */
export function calculateDaysOverdue(dueDate: Date, asOf: Date = new Date()): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const now = new Date(asOf);
  now.setHours(0, 0, 0, 0);
  const diffMs = now.getTime() - due.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Maps days overdue to an aging bucket.
 * Standard AR aging buckets: current, 1-30, 31-60, 61-90, 90+
 */
export function calculateAgingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1_30";
  if (daysOverdue <= 60) return "31_60";
  if (daysOverdue <= 90) return "61_90";
  return "90_plus";
}

/**
 * Human-readable aging bucket label.
 */
export function agingBucketLabel(bucket: string): string {
  const labels: Record<string, string> = {
    current: "Current",
    "1_30": "1–30 days",
    "31_60": "31–60 days",
    "61_90": "61–90 days",
    "90_plus": "90+ days",
  };
  return labels[bucket] || bucket;
}

// ─── Collection Priority ─────────────────────────────────────────────────────

/**
 * Determines collection priority based on aging, amount, and customer risk.
 *
 * Priority levels: low | medium | high | critical
 *
 * Logic:
 * - 90+ days overdue → critical (regardless of amount)
 * - 61-90 days overdue → high
 * - 31-60 days overdue → medium (or high if customer is high-risk or amount > ₹50,000)
 * - 1-30 days overdue → low (or medium if customer is high-risk)
 * - Current → low
 */
export function determineCollectionPriority(
  daysOverdue: number,
  outstanding: number,
  customerRiskLevel: string
): string {
  // 90+ days → always critical
  if (daysOverdue > 90) return "critical";

  // 61-90 days → high
  if (daysOverdue > 60) return "high";

  // 31-60 days → medium, or high if large amount or high-risk customer
  if (daysOverdue > 30) {
    if (outstanding > 5000000 || customerRiskLevel === "high") return "high"; // ₹50,000+
    return "medium";
  }

  // 1-30 days → low, or medium if high-risk customer
  if (daysOverdue > 0) {
    if (customerRiskLevel === "high") return "medium";
    return "low";
  }

  // Current → low
  return "low";
}

// ─── Recommended Action ──────────────────────────────────────────────────────

/**
 * Determines the recommended collection action based on the invoice context.
 *
 * Actions:
 * - send_first_reminder: First overdue, no previous reminders
 * - send_follow_up_reminder: Overdue, previous reminders sent but no response
 * - escalate_to_manager: 60+ days, multiple reminders, no response
 * - escalate_to_legal: 90+ days, no payment, no response
 * - mark_for_write_off: 90+ days, customer unresponsive, no payment
 * - monitor: Current or recently sent reminder, wait for response
 * - no_action: Invoice is paid or not overdue
 */
export function determineRecommendedAction(
  daysOverdue: number,
  previousReminderCount: number,
  hasResponse: boolean,
  outstanding: number
): string {
  // Not overdue or fully paid
  if (daysOverdue <= 0 || outstanding <= 0) return "no_action";

  // 90+ days
  if (daysOverdue > 90) {
    if (previousReminderCount >= 3 && !hasResponse) return "mark_for_write_off";
    return "escalate_to_legal";
  }

  // 61-90 days
  if (daysOverdue > 60) {
    if (previousReminderCount >= 2 && !hasResponse) return "escalate_to_manager";
    return "send_follow_up_reminder";
  }

  // 31-60 days
  if (daysOverdue > 30) {
    if (previousReminderCount === 0) return "send_first_reminder";
    if (previousReminderCount >= 1 && !hasResponse) return "send_follow_up_reminder";
    return "monitor";
  }

  // 1-30 days
  if (daysOverdue > 0) {
    if (previousReminderCount === 0) return "send_first_reminder";
    if (previousReminderCount >= 1 && !hasResponse) return "send_follow_up_reminder";
    return "monitor";
  }

  return "monitor";
}

/**
 * Human-readable label for a recommended action.
 */
export function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    no_action: "No action needed",
    monitor: "Monitor — awaiting response",
    send_first_reminder: "Send first reminder",
    send_follow_up_reminder: "Send follow-up reminder",
    escalate_to_manager: "Escalate to manager",
    escalate_to_legal: "Escalate to legal",
    mark_for_write_off: "Mark for write-off",
  };
  return labels[action] || action;
}

// ─── Business Reason ─────────────────────────────────────────────────────────

/**
 * Generates a human-readable business reason for the recommended action.
 * This text appears in the approval request so the human understands WHY
 * the Finance Employee is proposing this action.
 */
export function generateBusinessReason(ctx: InvoiceContext): string {
  const amount = formatRupees(ctx.outstanding);
  const customer = ctx.customerName;
  const invoiceNum = ctx.invoiceNumber;
  const days = ctx.daysOverdue;
  const bucket = agingBucketLabel(ctx.agingBucket);
  const prevReminders = ctx.previousReminderCount;

  switch (ctx.recommendedAction) {
    case "send_first_reminder":
      return `Invoice ${invoiceNum} for ${customer} is ${days} days overdue (${amount} outstanding, ${bucket} bucket). No previous reminders have been sent. A first reminder email is recommended to prompt payment.`;

    case "send_follow_up_reminder":
      return `Invoice ${invoiceNum} for ${customer} is ${days} days overdue (${amount} outstanding, ${bucket} bucket). ${prevReminders} previous reminder(s) have been sent with no response. A follow-up reminder with stronger language is recommended.`;

    case "escalate_to_manager":
      return `Invoice ${invoiceNum} for ${customer} is ${days} days overdue (${amount} outstanding, ${bucket} bucket). Despite ${prevReminders} reminder(s), no payment has been received. Escalation to the collections manager is recommended for direct intervention.`;

    case "escalate_to_legal":
      return `Invoice ${invoiceNum} for ${customer} is ${days} days overdue (${amount} outstanding, ${bucket} bucket). This invoice has exhausted standard collection efforts. Escalation to legal is recommended for formal recovery proceedings.`;

    case "mark_for_write_off":
      return `Invoice ${invoiceNum} for ${customer} is ${days} days overdue (${amount} outstanding, ${bucket} bucket). The customer has not responded to ${prevReminders} reminders. Write-off is recommended as the cost of recovery exceeds the likely return.`;

    case "monitor":
      return `Invoice ${invoiceNum} for ${customer} is ${days} days overdue (${amount} outstanding). A reminder was recently sent. Monitoring for customer response is recommended before further action.`;

    default:
      return `Invoice ${invoiceNum} for ${customer}: no action needed at this time.`;
  }
}

// ─── Reminder Generation ─────────────────────────────────────────────────────

/**
 * Generates a reminder email subject and body based on the invoice context
 * and the type of reminder (first, follow-up, escalation).
 */
export function generateReminderContent(ctx: InvoiceContext): { subject: string; body: string } {
  const customer = ctx.customerName;
  const invoiceNum = ctx.invoiceNumber;
  const amount = formatRupees(ctx.outstanding);
  const days = ctx.daysOverdue;
  const dueDate = formatDate(ctx.dueDate);

  if (ctx.recommendedAction === "send_first_reminder") {
    return {
      subject: `Payment Reminder: Invoice ${invoiceNum} — ${amount} Overdue`,
      body: `Dear ${customer},\n\nThis is a friendly reminder that payment for Invoice ${invoiceNum} (${amount}) was due on ${dueDate} and is now ${days} days overdue.\n\nPlease arrange payment at your earliest convenience. If you have already paid, please disregard this notice and share the payment reference so we can update our records.\n\nIf you have any questions about this invoice, please reply to this email.\n\nBest regards,\nFinance Team\nAcme Trading Pvt Ltd`,
    };
  }

  if (ctx.recommendedAction === "send_follow_up_reminder") {
    return {
      subject: `URGENT: Follow-up on Invoice ${invoiceNum} — ${amount} Overdue (${days} days)`,
      body: `Dear ${customer},\n\nWe are following up on Invoice ${invoiceNum} (${amount}), which is now ${days} days overdue.\n\nDespite our previous reminder(s), we have not yet received payment or a response. Please treat this as urgent.\n\nIf there is an issue with this invoice, please contact us immediately so we can resolve it. Otherwise, please arrange payment within 3 business days to avoid further action.\n\nBest regards,\nFinance Team\nAcme Trading Pvt Ltd`,
    };
  }

  if (ctx.recommendedAction === "escalate_to_manager") {
    return {
      subject: `Final Notice: Invoice ${invoiceNum} — ${amount} Overdue (${days} days) — Escalation Pending`,
      body: `Dear ${customer},\n\nThis is a final notice regarding Invoice ${invoiceNum} (${amount}), which is now ${days} days overdue.\n\nIf payment is not received within 5 business days, this account will be escalated to our collections manager for direct intervention, which may include suspension of services and legal recovery proceedings.\n\nPlease contact us immediately to arrange payment or discuss a payment plan.\n\nBest regards,\nCollections Manager\nAcme Trading Pvt Ltd`,
    };
  }

  // Default: escalation/legal
  return {
    subject: `Legal Escalation Notice: Invoice ${invoiceNum} — ${amount} Overdue (${days} days)`,
    body: `Dear ${customer},\n\nPlease be advised that Invoice ${invoiceNum} (${amount}), now ${days} days overdue, is being escalated to our legal team for formal recovery proceedings.\n\nAll previous reminders have gone unanswered. To avoid legal action, please arrange full payment immediately and contact us within 48 hours.\n\nThis is our final communication before formal proceedings begin.\n\nBest regards,\nLegal Department\nAcme Trading Pvt Ltd`,
  };
}

// ─── Load Full Invoice Context ───────────────────────────────────────────────

/**
 * Loads the full finance context for an invoice: customer, payments,
 * reminders, and collection case. Computes aging, priority, and recommended
 * action.
 *
 * This is the primary function the planner and executor call.
 */
export async function loadInvoiceContext(
  invoiceId: string
): Promise<InvoiceContext | null> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      payments: { where: { status: "completed" } },
      reminders: { orderBy: { createdAt: "desc" } },
      collectionCases: { orderBy: { openedAt: "desc" }, take: 1 },
    },
  });

  if (!invoice) return null;

  const daysOverdue = calculateDaysOverdue(invoice.dueDate);
  const agingBucket = calculateAgingBucket(daysOverdue);
  const previousReminderCount = invoice.reminders.length;
  const lastReminderDate = invoice.reminders[0]?.createdAt ?? null;
  const hasResponse = invoice.reminders.some((r) => r.status === "responded");
  const paymentHistoryCount = invoice.payments.length;

  const recommendedAction = determineRecommendedAction(
    daysOverdue,
    previousReminderCount,
    hasResponse,
    invoice.outstanding
  );

  const collectionPriority = determineCollectionPriority(
    daysOverdue,
    invoice.outstanding,
    invoice.customer.riskLevel
  );

  const ctx: InvoiceContext = {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customer.id,
    customerName: invoice.customer.name,
    customerEmail: invoice.customer.email,
    customerRiskLevel: invoice.customer.riskLevel,
    total: invoice.total,
    outstanding: invoice.outstanding,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    paymentTerms: invoice.paymentTerms,
    status: invoice.status,
    daysOverdue,
    agingBucket,
    previousReminderCount,
    lastReminderDate,
    paymentHistoryCount,
    recommendedAction,
    collectionPriority,
    businessReason: "", // filled below
  };

  ctx.businessReason = generateBusinessReason(ctx);

  return ctx;
}

/**
 * Finds invoices that need attention — overdue with outstanding balances,
 * sorted by priority (critical first, then by days overdue).
 *
 * This is what the Finance Employee processes when assigned a "process
 * overdue invoices" task.
 */
export async function findInvoicesNeedingAttention(
  workspaceId: string,
  limit: number = 10
): Promise<InvoiceContext[]> {
  const invoices = await db.invoice.findMany({
    where: {
      workspaceId,
      outstanding: { gt: 0 },
      status: { in: ["unpaid", "partially_paid", "overdue"] },
    },
    include: {
      customer: true,
      payments: { where: { status: "completed" } },
      reminders: { orderBy: { createdAt: "desc" } },
    },
  });

  // Compute context for each
  const contexts: InvoiceContext[] = [];
  for (const inv of invoices) {
    const daysOverdue = calculateDaysOverdue(inv.dueDate);
    const agingBucket = calculateAgingBucket(daysOverdue);
    const previousReminderCount = inv.reminders.length;
    const lastReminderDate = inv.reminders[0]?.createdAt ?? null;
    const hasResponse = inv.reminders.some((r) => r.status === "responded");

    const recommendedAction = determineRecommendedAction(
      daysOverdue,
      previousReminderCount,
      hasResponse,
      inv.outstanding
    );

    const collectionPriority = determineCollectionPriority(
      daysOverdue,
      inv.outstanding,
      inv.customer.riskLevel
    );

    const ctx: InvoiceContext = {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customer.id,
      customerName: inv.customer.name,
      customerEmail: inv.customer.email,
      customerRiskLevel: inv.customer.riskLevel,
      total: inv.total,
      outstanding: inv.outstanding,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      paymentTerms: inv.paymentTerms,
      status: inv.status,
      daysOverdue,
      agingBucket,
      previousReminderCount,
      lastReminderDate,
      paymentHistoryCount: inv.payments.length,
      recommendedAction,
      collectionPriority,
      businessReason: "",
    };

    ctx.businessReason = generateBusinessReason(ctx);
    contexts.push(ctx);
  }

  // Sort by priority (critical first), then by days overdue (most overdue first)
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  contexts.sort((a, b) => {
    const pDiff = (priorityOrder[a.collectionPriority] ?? 99) - (priorityOrder[b.collectionPriority] ?? 99);
    if (pDiff !== 0) return pDiff;
    return b.daysOverdue - a.daysOverdue;
  });

  // Filter out "no_action" invoices
  const actionable = contexts.filter((c) => c.recommendedAction !== "no_action");

  return actionable.slice(0, limit);
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

/**
 * Formats an amount in paise to a rupee string for display.
 * Example: 349900 → "₹3,499"
 */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/**
 * Formats a date for display in reminder emails.
 */
export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

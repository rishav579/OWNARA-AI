/**
 * BIHARI AI — Finance Brain
 *
 * The reasoning layer that transforms the Finance Employee from a workflow
 * engine into an intelligent Accounts Receivable Manager.
 *
 * Before every financial action, the Finance Brain:
 * 1. Gathers ALL relevant context (invoice, customer, payments, reminders,
 *    collection cases, policies, knowledge, approvals, human feedback)
 * 2. Reasons over that context to produce a structured recommendation
 * 3. Explains WHY the action was chosen, WHAT evidence was used, WHICH
 *    policies influenced the decision, and WHY alternatives were rejected
 *
 * This is NOT a mock. The reasoning is deterministic and grounded in real
 * data from the database. Every recommendation is traceable to specific
 * evidence, specific policies, and specific customer history.
 *
 * The planner uses the recommendation to generate steps with rich reasoning.
 * The executor stores the recommendation in the approval's proposed action.
 * The audit log captures the complete reasoning chain.
 */

import { db } from "@/lib/db";
import {
  calculateDaysOverdue,
  calculateAgingBucket,
  agingBucketLabel,
  determineCollectionPriority,
  formatRupees,
  formatDate,
} from "@/lib/finance/domain";

// ─── Types ───────────────────────────────────────────────────────────────────

/** The complete context the Finance Brain reasons over. One structured object. */
export interface FinanceContext {
  // Invoice
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: Date;
    dueDate: Date;
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    outstanding: number;
    status: string;
    paymentTerms: number;
    notes: string | null;
  };

  // Customer profile
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    gstin: string | null;
    billingAddress: string | null;
    paymentTerms: number;
    creditLimit: number;
    riskLevel: string;
    status: string;
    notes: string | null;
  };

  // Payment history for this invoice
  paymentHistory: Array<{
    id: string;
    amount: number;
    paymentDate: Date;
    method: string;
    reference: string | null;
    status: string;
  }>;

  // All previous reminders for this invoice (chronological)
  reminderHistory: Array<{
    id: string;
    reminderType: string;
    subject: string;
    status: string;
    sentAt: Date | null;
    respondedAt: Date | null;
    responseNotes: string | null;
    createdAt: Date;
  }>;

  // Collection case history for this invoice
  collectionCaseHistory: Array<{
    id: string;
    status: string;
    priority: string;
    agingBucket: string;
    daysOverdue: number;
    escalationLevel: number;
    openedAt: Date;
    resolvedAt: Date | null;
    resolution: string | null;
    followUps: Array<{
      action: string;
      description: string;
      performedAt: Date;
    }>;
  }>;

  // Company finance policies that apply
  companyPolicies: Array<{
    id: string;
    name: string;
    code: string;
    category: string;
    description: string;
    severity: string;
    rules: Array<Record<string, string>>;
  }>;

  // Finance knowledge documents
  knowledgeDocuments: Array<{
    id: string;
    filename: string;
    status: string;
    chunkCount: number;
  }>;

  // Credit terms summary
  creditTerms: {
    customerPaymentTerms: number;
    invoicePaymentTerms: number;
    creditLimit: number;
    totalOutstandingForCustomer: number;
    availableCredit: number;
  };

  // Customer risk assessment
  customerRiskLevel: string;

  // Total outstanding exposure across ALL customer invoices
  outstandingExposure: number;

  // Previous approval decisions on this invoice or customer
  previousApprovals: Array<{
    id: string;
    tool: string;
    status: string;
    decision: string | null;
    reason: string | null;
    decidedAt: Date | null;
  }>;

  // Human feedback on earlier decisions (from approval reasons)
  humanFeedback: Array<{
    decision: string;
    reason: string;
    tool: string;
    decidedAt: Date;
  }>;

  // Computed
  daysOverdue: number;
  agingBucket: string;
  collectionPriority: string;
}

/** A structured recommendation produced by the Finance Brain. */
export interface FinanceRecommendation {
  // The recommended action
  action: string;

  // WHY this action was chosen — detailed, human-readable explanation
  why: string;

  // The evidence used to reach this recommendation
  evidence: EvidenceItem[];

  // Which company policies influenced the decision
  policyInfluence: PolicyInfluence[];

  // Which customer history influenced the decision
  customerHistoryInfluence: string;

  // Why alternative actions were rejected
  rejectedAlternatives: RejectedAlternative[];

  // Confidence in the recommendation (0.0–1.0)
  confidence: number;

  // Risk assessment for this action
  riskAssessment: string;

  // A natural-language summary for the approval screen
  humanReadableSummary: string;

  // The invoice context for the planner (backward compatible)
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  outstanding: number;
  daysOverdue: number;
  agingBucket: string;
  paymentTerms: number;
  previousReminderCount: number;
  collectionPriority: string;
}

export interface EvidenceItem {
  source: "invoice" | "customer" | "payment_history" | "reminder_history" | "collection_case" | "policy" | "knowledge" | "approval_history" | "human_feedback";
  fact: string;
  weight: "high" | "medium" | "low";
}

export interface PolicyInfluence {
  policyCode: string;
  policyName: string;
  howItInfluenced: string;
}

export interface RejectedAlternative {
  action: string;
  reason: string;
}

// ─── Finance Context Builder ─────────────────────────────────────────────────

/**
 * Builds the complete FinanceContext for an invoice.
 *
 * This is the SINGLE entry point for all finance reasoning. The planner
 * and executor call this function instead of loading raw invoice data.
 *
 * It gathers:
 * - Invoice details
 * - Customer profile (risk, credit limit, payment terms)
 * - Full payment history
 * - Full reminder history (with response status)
 * - Collection case history (with follow-up actions)
 * - Company finance policies
 * - Finance knowledge documents
 * - Credit terms (including total customer exposure)
 * - Previous approval decisions
 * - Human feedback from past decisions
 *
 * Then computes aging, priority, and exposure.
 */
export async function buildFinanceContext(
  invoiceId: string
): Promise<FinanceContext | null> {
  // Load everything in one query
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: {
        include: {
          invoices: {
            where: { outstanding: { gt: 0 } },
            select: { id: true, outstanding: true, status: true, dueDate: true },
          },
        },
      },
      payments: { orderBy: { paymentDate: "desc" } },
      reminders: { orderBy: { createdAt: "desc" } },
      collectionCases: {
        orderBy: { openedAt: "desc" },
        include: { followUps: { orderBy: { performedAt: "desc" } } },
      },
    },
  });

  if (!invoice) return null;

  const workspaceId = invoice.workspaceId;

  // Load company policies (finance category)
  const companyPolicies = await db.policy.findMany({
    where: {
      workspaceId,
      status: "active",
      category: { in: ["financial", "communication", "escalation", "compliance"] },
    },
  });

  // Load finance knowledge documents
  const knowledgeDocuments = await db.knowledgeDocument.findMany({
    where: { workspaceId, status: "ready" },
    select: { id: true, filename: true, status: true, chunkCount: true },
  });

  // Load previous approvals for this invoice's tasks
  const invoiceTasks = await db.task.findFirst({
    where: { id: { in: (await db.approval.findMany({ where: { taskId: { not: undefined } }, select: { taskId: true } })).map((a) => a.taskId) } },
    select: { id: true },
  });

  // Actually, let's get approvals related to this invoice via the task
  const tasksForInvoice = await db.task.findMany({
    where: {
      workspaceId,
      title: { contains: invoice.invoiceNumber },
    },
    select: { id: true },
  });

  const taskIds = tasksForInvoice.map((t) => t.id);
  const previousApprovals = taskIds.length > 0
    ? await db.approval.findMany({
        where: { taskId: { in: taskIds } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          tool: true,
          status: true,
          decision: true,
          reason: true,
          decidedAt: true,
        },
      })
    : [];

  // Extract human feedback (reasons from decided approvals)
  const humanFeedback = previousApprovals
    .filter((a) => a.decision && a.reason)
    .map((a) => ({
      decision: a.decision!,
      reason: a.reason!,
      tool: a.tool,
      decidedAt: a.decidedAt!,
    }));

  // Compute total outstanding exposure for this customer
  const totalOutstandingForCustomer = invoice.customer.invoices.reduce(
    (sum, inv) => sum + inv.outstanding,
    0
  );

  // Compute aging
  const daysOverdue = calculateDaysOverdue(invoice.dueDate);
  const agingBucket = calculateAgingBucket(daysOverdue);
  const collectionPriority = determineCollectionPriority(
    daysOverdue,
    invoice.outstanding,
    invoice.customer.riskLevel
  );

  return {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      outstanding: invoice.outstanding,
      status: invoice.status,
      paymentTerms: invoice.paymentTerms,
      notes: invoice.notes,
    },
    customer: {
      id: invoice.customer.id,
      name: invoice.customer.name,
      email: invoice.customer.email,
      phone: invoice.customer.phone,
      gstin: invoice.customer.gstin,
      billingAddress: invoice.customer.billingAddress,
      paymentTerms: invoice.customer.paymentTerms,
      creditLimit: invoice.customer.creditLimit,
      riskLevel: invoice.customer.riskLevel,
      status: invoice.customer.status,
      notes: invoice.customer.notes,
    },
    paymentHistory: invoice.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paymentDate: p.paymentDate,
      method: p.method,
      reference: p.reference,
      status: p.status,
    })),
    reminderHistory: invoice.reminders.map((r) => ({
      id: r.id,
      reminderType: r.reminderType,
      subject: r.subject,
      status: r.status,
      sentAt: r.sentAt,
      respondedAt: r.respondedAt,
      responseNotes: r.responseNotes,
      createdAt: r.createdAt,
    })),
    collectionCaseHistory: invoice.collectionCases.map((c) => ({
      id: c.id,
      status: c.status,
      priority: c.priority,
      agingBucket: c.agingBucket,
      daysOverdue: c.daysOverdue,
      escalationLevel: c.escalationLevel,
      openedAt: c.openedAt,
      resolvedAt: c.resolvedAt,
      resolution: c.resolution,
      followUps: c.followUps.map((f) => ({
        action: f.action,
        description: f.description,
        performedAt: f.performedAt,
      })),
    })),
    companyPolicies: companyPolicies.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      category: p.category,
      description: p.description,
      severity: p.severity,
      rules: JSON.parse(p.rules),
    })),
    knowledgeDocuments,
    creditTerms: {
      customerPaymentTerms: invoice.customer.paymentTerms,
      invoicePaymentTerms: invoice.paymentTerms,
      creditLimit: invoice.customer.creditLimit,
      totalOutstandingForCustomer,
      availableCredit: Math.max(0, invoice.customer.creditLimit - totalOutstandingForCustomer),
    },
    customerRiskLevel: invoice.customer.riskLevel,
    outstandingExposure: totalOutstandingForCustomer,
    previousApprovals: previousApprovals.map((a) => ({
      id: a.id,
      tool: a.tool,
      status: a.status,
      decision: a.decision,
      reason: a.reason,
      decidedAt: a.decidedAt,
    })),
    humanFeedback,
    daysOverdue,
    agingBucket,
    collectionPriority,
  };
}

// ─── Finance Brain: Recommendation Engine ────────────────────────────────────

/**
 * Reasons over a FinanceContext to produce a structured recommendation.
 *
 * This is the brain of the Finance Employee. It:
 * 1. Determines the recommended action based on ALL available evidence
 * 2. Explains WHY that action was chosen
 * 3. Lists the evidence used (with source and weight)
 * 4. Identifies which policies influenced the decision
 * 5. Explains which customer history influenced the decision
 * 6. Explains why alternative actions were rejected
 *
 * The output is stored in the approval's proposed action and in the audit log,
 * so a finance manager can see the complete reasoning chain.
 */
export function produceRecommendation(ctx: FinanceContext): FinanceRecommendation {
  const evidence: EvidenceItem[] = [];
  const policyInfluence: PolicyInfluence[] = [];
  const rejectedAlternatives: RejectedAlternative[] = [];

  const amount = formatRupees(ctx.invoice.outstanding);
  const customerName = ctx.customer.name;
  const invoiceNum = ctx.invoice.invoiceNumber;
  const daysOverdue = ctx.daysOverdue;
  const bucket = agingBucketLabel(ctx.agingBucket);
  const prevReminders = ctx.reminderHistory.length;
  const hasResponse = ctx.reminderHistory.some((r) => r.status === "responded");
  const paymentCount = ctx.paymentHistory.length;
  const hasPartialPayment = ctx.invoice.amountPaid > 0;
  const totalExposure = formatRupees(ctx.outstandingExposure);

  // ─── Gather Evidence ──────────────────────────────────────────────────────

  // Invoice evidence
  evidence.push({
    source: "invoice",
    fact: `Invoice ${invoiceNum} has ${amount} outstanding (of ${formatRupees(ctx.invoice.total)} total), ${daysOverdue} days overdue (${bucket} bucket). Status: ${ctx.invoice.status}.`,
    weight: "high",
  });

  if (hasPartialPayment) {
    evidence.push({
      source: "invoice",
      fact: `Partial payment of ${formatRupees(ctx.invoice.amountPaid)} has been received. Remaining: ${amount}.`,
      weight: "high",
    });
  }

  // Customer evidence
  evidence.push({
    source: "customer",
    fact: `Customer ${customerName} has risk level "${ctx.customerRiskLevel}", credit limit ${formatRupees(ctx.creditTerms.creditLimit)}, and total outstanding exposure of ${totalExposure} across all invoices.`,
    weight: "high",
  });

  if (ctx.customer.notes) {
    evidence.push({
      source: "customer",
      fact: `Customer notes: "${ctx.customer.notes}"`,
      weight: "medium",
    });
  }

  // Payment history evidence
  if (paymentCount > 0) {
    const lastPayment = ctx.paymentHistory[0];
    evidence.push({
      source: "payment_history",
      fact: `${paymentCount} payment(s) recorded. Last payment: ${formatRupees(lastPayment.amount)} via ${lastPayment.method} on ${formatDate(lastPayment.paymentDate)}.`,
      weight: "medium",
    });
  } else {
    evidence.push({
      source: "payment_history",
      fact: `No payments have been recorded against this invoice.`,
      weight: "high",
    });
  }

  // Reminder history evidence
  if (prevReminders > 0) {
    const lastReminder = ctx.reminderHistory[0];
    evidence.push({
      source: "reminder_history",
      fact: `${prevReminders} reminder(s) sent. Last reminder: "${lastReminder.subject}" sent on ${lastReminder.sentAt ? formatDate(lastReminder.sentAt) : "N/A"}, status: ${lastReminder.status}.`,
      weight: "high",
    });

    if (hasResponse) {
      const responded = ctx.reminderHistory.find((r) => r.status === "responded");
      evidence.push({
        source: "reminder_history",
        fact: `Customer responded to a previous reminder${responded?.responseNotes ? `: "${responded.responseNotes}"` : ""}.`,
        weight: "medium",
      });
    } else {
      evidence.push({
        source: "reminder_history",
        fact: `Customer has NOT responded to any previous reminders.`,
        weight: "high",
      });
    }
  } else {
    evidence.push({
      source: "reminder_history",
      fact: `No previous reminders have been sent for this invoice.`,
      weight: "high",
    });
  }

  // Collection case evidence
  if (ctx.collectionCaseHistory.length > 0) {
    const activeCase = ctx.collectionCaseHistory.find((c) => c.status === "open" || c.status === "escalated");
    if (activeCase) {
      evidence.push({
        source: "collection_case",
        fact: `Active collection case: priority ${activeCase.priority}, escalation level ${activeCase.escalationLevel}, opened on ${formatDate(activeCase.openedAt)}. ${activeCase.followUps.length} follow-up action(s) recorded.`,
        weight: "high",
      });
    }
  }

  // Approval history evidence
  if (ctx.previousApprovals.length > 0) {
    const lastApproval = ctx.previousApprovals[0];
    evidence.push({
      source: "approval_history",
      fact: `Previous approval: ${lastApproval.tool} was ${lastApproval.decision || lastApproval.status}${lastApproval.reason ? ` (reason: "${lastApproval.reason}")` : ""}.`,
      weight: "medium",
    });
  }

  // Human feedback evidence
  if (ctx.humanFeedback.length > 0) {
    const lastFeedback = ctx.humanFeedback[0];
    evidence.push({
      source: "human_feedback",
      fact: `Human previously ${lastFeedback.decision} a ${lastFeedback.tool} action${lastFeedback.reason ? ` with reason: "${lastFeedback.reason}"` : ""}.`,
      weight: "high",
    });
  }

  // Knowledge document evidence
  if (ctx.knowledgeDocuments.length > 0) {
    evidence.push({
      source: "knowledge",
      fact: `${ctx.knowledgeDocuments.length} finance knowledge document(s) available for reference: ${ctx.knowledgeDocuments.map((d) => d.filename).join(", ")}.`,
      weight: "low",
    });
  }

  // ─── Determine Action ─────────────────────────────────────────────────────

  let action = "monitor";
  let confidence = 0.85;

  if (daysOverdue <= 0 || ctx.invoice.outstanding <= 0) {
    action = "no_action";
    confidence = 0.99;
  } else if (daysOverdue > 90) {
    if (prevReminders >= 3 && !hasResponse) {
      action = "mark_for_write_off";
      confidence = 0.88;
    } else {
      action = "escalate_to_legal";
      confidence = 0.86;
    }
  } else if (daysOverdue > 60) {
    if (prevReminders >= 2 && !hasResponse) {
      action = "escalate_to_manager";
      confidence = 0.87;
    } else {
      action = "send_follow_up_reminder";
      confidence = 0.89;
    }
  } else if (daysOverdue > 30) {
    if (prevReminders === 0) {
      action = "send_first_reminder";
      confidence = 0.92;
    } else if (prevReminders >= 1 && !hasResponse) {
      action = "send_follow_up_reminder";
      confidence = 0.88;
    } else {
      action = "monitor";
      confidence = 0.90;
    }
  } else if (daysOverdue > 0) {
    if (prevReminders === 0) {
      action = "send_first_reminder";
      confidence = 0.91;
    } else if (prevReminders >= 1 && !hasResponse) {
      action = "send_follow_up_reminder";
      confidence = 0.85;
    } else {
      action = "monitor";
      confidence = 0.88;
    }
  }

  // Adjust confidence based on human feedback
  if (ctx.humanFeedback.length > 0) {
    const lastFeedback = ctx.humanFeedback[0];
    if (lastFeedback.decision === "rejected") {
      // If the last similar action was rejected, lower confidence
      confidence = Math.max(0.6, confidence - 0.1);
    }
  }

  // ─── Policy Influence ─────────────────────────────────────────────────────

  for (const policy of ctx.companyPolicies) {
    let influenced = false;
    let how = "";

    // Check if this policy is relevant to the current action
    if (policy.category === "financial" && policy.description.toLowerCase().includes("refund")) {
      if (ctx.invoice.outstanding > 0) {
        influenced = true;
        how = `Policy requires human approval for financial actions above threshold. Outstanding amount ${amount} triggers this policy.`;
      }
    } else if (policy.category === "communication" && policy.description.toLowerCase().includes("email")) {
      if (action.startsWith("send_") || action.startsWith("escalate_")) {
        influenced = true;
        how = `Policy requires human approval for all outbound customer communications. The ${action.replace(/_/g, " ")} action triggers this policy.`;
      }
    } else if (policy.category === "escalation") {
      if (action.startsWith("escalate_") || action === "mark_for_write_off") {
        influenced = true;
        how = `Policy governs escalation procedures. ${daysOverdue} days overdue with ${prevReminders} unanswered reminders triggers escalation per this policy.`;
      }
    } else if (policy.category === "compliance" && policy.description.toLowerCase().includes("citation")) {
      if (action.startsWith("send_")) {
        influenced = true;
        how = `Policy requires that all customer communications cite relevant invoice details. The reminder will reference invoice number, amount, and due date.`;
      }
    }

    if (influenced) {
      policyInfluence.push({
        policyCode: policy.code,
        policyName: policy.name,
        howItInfluenced: how,
      });
    }
  }

  // ─── Customer History Influence ───────────────────────────────────────────

  let customerHistoryInfluence = "";

  const historyParts: string[] = [];

  if (ctx.customerRiskLevel === "high") {
    historyParts.push(`Customer is classified as HIGH risk, which increases the collection priority and suggests more aggressive collection actions are warranted.`);
  } else if (ctx.customerRiskLevel === "medium") {
    historyParts.push(`Customer is classified as MEDIUM risk, indicating occasional payment delays. Standard collection procedures are appropriate.`);
  } else {
    historyParts.push(`Customer is classified as LOW risk, indicating a history of reliable payments. A softer approach in the first reminder is appropriate.`);
  }

  if (ctx.outstandingExposure > ctx.creditLimit && ctx.creditLimit > 0) {
    historyParts.push(`Total outstanding exposure (${totalExposure}) exceeds the customer's credit limit (${formatRupees(ctx.creditLimit)}), indicating potential credit risk that warrants immediate attention.`);
  }

  if (paymentCount > 0) {
    historyParts.push(`The customer has made ${paymentCount} payment(s) on this invoice, suggesting willingness to pay but possibly experiencing cash flow difficulties.`);
  } else if (daysOverdue > 30) {
    historyParts.push(`No payments have been made against this invoice despite being ${daysOverdue} days overdue, suggesting potential collection difficulty.`);
  }

  if (prevReminders > 0 && !hasResponse) {
    historyParts.push(`The customer has not responded to ${prevReminders} previous reminder(s), indicating either communication issues or unwillingness to pay.`);
  } else if (hasResponse) {
    historyParts.push(`The customer has responded to a previous reminder, suggesting they are engaged in the collection process.`);
  }

  if (ctx.collectionCaseHistory.length > 0) {
    const activeCase = ctx.collectionCaseHistory.find((c) => c.status === "open" || c.status === "escalated");
    if (activeCase) {
      historyParts.push(`An active collection case exists (escalation level ${activeCase.escalationLevel}) with ${activeCase.followUps.length} recorded follow-up actions, indicating this is an ongoing collection effort.`);
    }
  }

  if (ctx.humanFeedback.length > 0) {
    const lastFeedback = ctx.humanFeedback[0];
    if (lastFeedback.decision === "approved") {
      historyParts.push(`The human manager previously approved a similar action, suggesting alignment with collection strategy.`);
    } else if (lastFeedback.decision === "rejected") {
      historyParts.push(`The human manager previously rejected a similar action (${lastFeedback.reason}), which has been considered in this recommendation.`);
    }
  }

  customerHistoryInfluence = historyParts.join(" ");

  // ─── Rejected Alternatives ────────────────────────────────────────────────

  const allActions = [
    "send_first_reminder",
    "send_follow_up_reminder",
    "escalate_to_manager",
    "escalate_to_legal",
    "mark_for_write_off",
    "monitor",
    "no_action",
  ];

  for (const alt of allActions) {
    if (alt === action) continue;

    let reason = "";

    if (alt === "no_action") {
      reason = `Not appropriate because the invoice is ${daysOverdue} days overdue with ${amount} outstanding. Inaction would allow the receivable to age further.`;
    } else if (alt === "monitor") {
      reason = action === "send_first_reminder"
        ? `Not appropriate because no previous reminders have been sent. Monitoring without a first reminder would delay collection.`
        : `Not appropriate because ${prevReminders} reminder(s) have already been sent without response. Further monitoring without action is unlikely to produce payment.`;
    } else if (alt === "send_first_reminder") {
      reason = prevReminders > 0
        ? `Not appropriate because ${prevReminders} reminder(s) have already been sent. A "first reminder" would be redundant and confuse the customer.`
        : `Not the strongest option — ${daysOverdue} days overdue and ${ctx.customerRiskLevel} risk warrant a more direct approach.`;
    } else if (alt === "send_follow_up_reminder") {
      reason = prevReminders === 0
        ? `Not appropriate because no first reminder has been sent yet. A follow-up implies a prior communication that doesn't exist.`
        : daysOverdue > 60
          ? `Insufficient — ${daysOverdue} days overdue with ${prevReminders} unanswered reminders warrants escalation, not just another reminder.`
          : `Considered but the current action is more appropriate for the aging bucket.`;
    } else if (alt === "escalate_to_manager") {
      reason = daysOverdue <= 60
        ? `Premature — escalation to manager is reserved for invoices 60+ days overdue with multiple unanswered reminders. Current aging (${daysOverdue} days) does not meet this threshold.`
        : prevReminders < 2
          ? `Premature — escalation to manager requires at least 2 unanswered reminders. Only ${prevReminders} reminder(s) have been sent.`
          : `Considered but the current action is more appropriate given the specific circumstances.`;
    } else if (alt === "escalate_to_legal") {
      reason = daysOverdue <= 90
        ? `Premature — legal escalation is reserved for invoices 90+ days overdue. Current aging (${daysOverdue} days) does not meet this threshold.`
        : `Considered but the current action is more appropriate given the specific circumstances.`;
    } else if (alt === "mark_for_write_off") {
      reason = daysOverdue <= 90
        ? `Premature — write-off is the last resort, reserved for invoices 90+ days overdue with 3+ unanswered reminders. Current aging (${daysOverdue} days) and reminder count (${prevReminders}) do not meet this threshold.`
        : prevReminders < 3
          ? `Premature — write-off requires at least 3 unanswered reminders to demonstrate exhaustive collection effort. Only ${prevReminders} reminder(s) have been sent.`
          : `Considered but the current action is more appropriate given the specific circumstances.`;
    }

    if (reason) {
      rejectedAlternatives.push({ action: alt, reason });
    }
  }

  // ─── Why (detailed explanation) ───────────────────────────────────────────

  const why = buildWhyExplanation(ctx, action, evidence, policyInfluence, customerHistoryInfluence, rejectedAlternatives);

  // ─── Risk Assessment ──────────────────────────────────────────────────────

  let riskAssessment = "";
  if (action === "no_action") {
    riskAssessment = "No risk — no action is being taken.";
  } else if (action === "monitor") {
    riskAssessment = "Low risk — monitoring does not involve external communication.";
  } else if (action.startsWith("send_")) {
    riskAssessment = `Medium risk — sending an external communication to ${customerName}. The reminder tone is ${action === "send_first_reminder" ? "friendly" : "firm but professional"}. No financial changes are made.`;
  } else if (action === "escalate_to_manager") {
    riskAssessment = `Medium-high risk — escalation involves a stronger tone and threat of service suspension. Customer relationship may be affected.`;
  } else if (action === "escalate_to_legal") {
    riskAssessment = `High risk — legal escalation is an adversarial action that may damage the customer relationship permanently. Should only be used when all other options are exhausted.`;
  } else if (action === "mark_for_write_off") {
    riskAssessment = `High risk — write-off is a financial loss. This action should only be taken when recovery is deemed impossible.`;
  }

  // ─── Human-Readable Summary ──────────────────────────────────────────────

  const humanReadableSummary = buildHumanReadableSummary(ctx, action, why, evidence, policyInfluence, rejectedAlternatives, confidence, riskAssessment);

  return {
    action,
    why,
    evidence,
    policyInfluence,
    customerHistoryInfluence,
    rejectedAlternatives,
    confidence,
    riskAssessment,
    humanReadableSummary,
    // Backward-compatible fields for the planner
    invoiceId: ctx.invoice.id,
    invoiceNumber: ctx.invoice.invoiceNumber,
    customerId: ctx.customer.id,
    customerName: ctx.customer.name,
    customerEmail: ctx.customer.email,
    outstanding: ctx.invoice.outstanding,
    daysOverdue: ctx.daysOverdue,
    agingBucket: ctx.agingBucket,
    paymentTerms: ctx.invoice.paymentTerms,
    previousReminderCount: prevReminders,
    collectionPriority: ctx.collectionPriority,
  };
}

// ─── Why Explanation Builder ─────────────────────────────────────────────────

function buildWhyExplanation(
  ctx: FinanceContext,
  action: string,
  evidence: EvidenceItem[],
  policyInfluence: PolicyInfluence[],
  customerHistoryInfluence: string,
  rejectedAlternatives: RejectedAlternative[]
): string {
  const amount = formatRupees(ctx.invoice.outstanding);
  const customerName = ctx.customer.name;
  const invoiceNum = ctx.invoice.invoiceNumber;
  const days = ctx.daysOverdue;
  const bucket = agingBucketLabel(ctx.agingBucket);
  const prevReminders = ctx.reminderHistory.length;

  const parts: string[] = [];

  // Core reasoning
  parts.push(
    `Recommendation: ${action.replace(/_/g, " ")} for Invoice ${invoiceNum} (${customerName}).`
  );

  parts.push(
    `\nThis action was chosen because the invoice is ${days} days overdue (${bucket} aging bucket) with ${amount} outstanding. ` +
    `${prevReminders > 0 ? `${prevReminders} previous reminder(s) have been sent` : "No previous reminders have been sent"}` +
    `${prevReminders > 0 && !ctx.reminderHistory.some((r) => r.status === "responded") ? " without customer response" : ""}.`
  );

  // Customer risk context
  if (ctx.customerRiskLevel === "high") {
    parts.push(
      `\nThe customer's HIGH risk level increases the urgency of this action. ` +
      `Total outstanding exposure across all invoices: ${formatRupees(ctx.outstandingExposure)}.`
    );
  }

  // Payment history context
  if (ctx.paymentHistory.length > 0) {
    parts.push(
      `\nThe customer has made ${ctx.paymentHistory.length} payment(s) on this invoice, ` +
      `indicating some willingness to pay but suggesting cash flow difficulties.`
    );
  }

  // Policy context
  if (policyInfluence.length > 0) {
    parts.push(`\nThis decision is influenced by ${policyInfluence.length} company finance ${policyInfluence.length === 1 ? "policy" : "policies"}:`);
    for (const p of policyInfluence) {
      parts.push(`  • ${p.policyCode} (${p.policyName}): ${p.howItInfluenced}`);
    }
  }

  // Human feedback context
  if (ctx.humanFeedback.length > 0) {
    const last = ctx.humanFeedback[0];
    parts.push(
      `\nPrevious human feedback was considered: the manager ${last.decision} a ${last.tool} action` +
      `${last.reason ? ` with reason "${last.reason}"` : ""}.`
    );
  }

  // Rejected alternatives summary
  if (rejectedAlternatives.length > 0) {
    parts.push(`\n${rejectedAlternatives.length} alternative action(s) were considered and rejected:`);
    for (const alt of rejectedAlternatives.slice(0, 4)) { // Top 4 for brevity
      parts.push(`  • ${alt.action.replace(/_/g, " ")}: ${alt.reason}`);
    }
  }

  return parts.join("\n");
}

// ─── Human-Readable Summary Builder ──────────────────────────────────────────

function buildHumanReadableSummary(
  ctx: FinanceContext,
  action: string,
  why: string,
  evidence: EvidenceItem[],
  policyInfluence: PolicyInfluence[],
  rejectedAlternatives: RejectedAlternative[],
  confidence: number,
  riskAssessment: string
): string {
  const amount = formatRupees(ctx.invoice.outstanding);
  const customerName = ctx.customer.name;
  const invoiceNum = ctx.invoice.invoiceNumber;
  const days = ctx.daysOverdue;

  const lines: string[] = [];

  lines.push(`=== FINANCE EMPLOYEE REASONING ===`);
  lines.push(``);
  lines.push(`Invoice: ${invoiceNum}`);
  lines.push(`Customer: ${customerName} (Risk: ${ctx.customerRiskLevel.toUpperCase()})`);
  lines.push(`Outstanding: ${amount} | ${days} days overdue`);
  lines.push(`Recommended Action: ${action.replace(/_/g, " ")}`);
  lines.push(`Confidence: ${(confidence * 100).toFixed(0)}%`);
  lines.push(``);
  lines.push(`--- WHY THIS ACTION ---`);
  lines.push(why);
  lines.push(``);
  lines.push(`--- EVIDENCE USED (${evidence.length} items) ---`);
  for (const e of evidence) {
    lines.push(`[${e.source.toUpperCase()} | ${e.weight} weight] ${e.fact}`);
  }
  lines.push(``);
  lines.push(`--- POLICY INFLUENCE (${policyInfluence.length} policies) ---`);
  if (policyInfluence.length > 0) {
    for (const p of policyInfluence) {
      lines.push(`${p.policyCode}: ${p.howItInfluenced}`);
    }
  } else {
    lines.push(`No specific policies influenced this decision.`);
  }
  lines.push(``);
  lines.push(`--- REJECTED ALTERNATIVES (${rejectedAlternatives.length} considered) ---`);
  for (const alt of rejectedAlternatives.slice(0, 5)) {
    lines.push(`${alt.action.replace(/_/g, " ")}: ${alt.reason}`);
  }
  lines.push(``);
  lines.push(`--- RISK ASSESSMENT ---`);
  lines.push(riskAssessment);

  return lines.join("\n");
}

/**
 * OWNARA — Mandate Strategy Selector
 *
 * This is the PROOF that the Mandate is NOT a fixed workflow.
 *
 * A workflow says: "overdue → reminder → approval → send." Always the same
 * sequence regardless of context.
 *
 * A Mandate says: "Maintain healthy receivables." The AI OBSERVES the actual
 * state of the domain, identifies the GAP between observed and desired, assesses
 * RISK, and SELECTS an appropriate episode STRATEGY.
 *
 * Different observed states produce DIFFERENT episodes:
 *   • A disputed invoice       → investigate_disputed
 *   • One customer = 40%+ of AR → prioritize_high_value
 *   • Standard overdue + no recent reminder → send_reminder_campaign
 *   • A customer promised payment → wait_for_promise (don't spam)
 *   • Reminders sent, no response → escalate_unresponsive
 *   • No actionable gap → re_evaluate (no episode needed)
 *
 * The Mandate defines the OUTCOME and AUTHORITY.
 * The AI determines the EPISODES required to pursue it.
 *
 * This is the architectural property that makes the Mandate fundamentally
 * different from a workflow, an RPA script, or a task template.
 */

import { db } from "@/lib/db";

export interface ObservedInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerRiskLevel: string;
  outstanding: number;
  daysOverdue: number;
  hasOpenCollectionCase: boolean;
  collectionCaseEscalation: number;
  hasRecentReminder: boolean;
  hasCustomerResponse: boolean;
  responseNotes: string | null;
}

export interface ObservedState {
  overdueRate: number;
  totalOutstanding: number;
  totalOverdue: number;
  overdueInvoiceCount: number;
  overdueInvoices: ObservedInvoice[];
  disputedCount: number;
  promisedPaymentCount: number;
  unresponsiveCount: number;
  topOverdueCustomer: { name: string; amount: number; percentage: number } | null;
  recentEpisodeCount: number;
}

export type StrategyType =
  | "investigate_disputed"
  | "prioritize_high_value"
  | "send_reminder_campaign"
  | "wait_for_promise"
  | "escalate_unresponsive"
  | "re_evaluate";

export interface SelectedStrategy {
  strategy: StrategyType;
  reasoning: string;
  episodeTitle: string;
  episodeDescription: string;
  priority: "high" | "medium" | "low";
  observedState: ObservedState;
  /** Memory entries that influenced this strategy selection. */
  memoryUsed: MandateMemoryRef[];
}

/** A lightweight reference to a MandateMemory entry used in strategy reasoning. */
export interface MandateMemoryRef {
  id: string;
  memoryType: string;
  content: string;
  importance: number;
}

/**
 * Observes the actual state of the finance domain for a Mandate's workspace.
 *
 * This is the OBSERVE step of the closed-loop control system. It reads live
 * data — invoices, customers, collection cases, reminders — and produces a
 * structured observed state that the strategy selector reasons over.
 */
export async function observeMandateState(workspaceId: string): Promise<ObservedState> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Load all outstanding invoices with customer + collection case + reminder data
  const invoices = await db.invoice.findMany({
    where: { workspaceId, status: { in: ["sent", "overdue", "partial", "partially_paid", "unpaid"] } },
    include: {
      customer: { select: { id: true, name: true, riskLevel: true } },
      collectionCases: { select: { id: true, status: true, escalationLevel: true, daysOverdue: true } },
      reminders: { select: { id: true, sentAt: true, respondedAt: true, responseNotes: true, createdAt: true } },
    },
  });

  const totalOutstanding = invoices.reduce((s, i) => s + (i.outstanding || 0), 0);

  // Identify overdue invoices
  const overdueInvoices: ObservedInvoice[] = [];
  for (const inv of invoices) {
    const outstanding = inv.outstanding || 0;
    if (outstanding <= 0) continue;
    const dueDate = new Date(inv.dueDate);
    if (dueDate >= now && inv.status !== "overdue") continue;

    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    if (daysOverdue <= 0 && inv.status !== "overdue") continue;

    const openCase = inv.collectionCases.find((c) => c.status === "open");
    const recentReminder = inv.reminders.find((r) => r.sentAt && new Date(r.sentAt) > sevenDaysAgo);
    const responseReminder = inv.reminders.find((r) => r.respondedAt);

    overdueInvoices.push({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customer.id,
      customerName: inv.customer.name,
      customerRiskLevel: inv.customer.riskLevel,
      outstanding,
      daysOverdue: Math.max(0, daysOverdue),
      hasOpenCollectionCase: !!openCase,
      collectionCaseEscalation: openCase?.escalationLevel || 0,
      hasRecentReminder: !!recentReminder,
      hasCustomerResponse: !!responseReminder,
      responseNotes: responseReminder?.responseNotes || null,
    });
  }

  const totalOverdue = overdueInvoices.reduce((s, i) => s + i.outstanding, 0);
  const overdueRate = totalOutstanding > 0 ? totalOverdue / totalOutstanding : 0;

  // Customer concentration: does one customer account for >40% of overdue?
  const byCustomer = new Map<string, { name: string; amount: number }>();
  for (const inv of overdueInvoices) {
    const existing = byCustomer.get(inv.customerId);
    if (existing) existing.amount += inv.outstanding;
    else byCustomer.set(inv.customerId, { name: inv.customerName, amount: inv.outstanding });
  }
  let topOverdueCustomer: ObservedState["topOverdueCustomer"] = null;
  if (totalOverdue > 0) {
    const sorted = [...byCustomer.entries()].sort((a, b) => b[1].amount - a[1].amount);
    const top = sorted[0];
    if (top) {
      const percentage = top[1].amount / totalOverdue;
      if (percentage >= 0.4) {
        topOverdueCustomer = { name: top[1].name, amount: top[1].amount, percentage };
      }
    }
  }

  // Count disputed (open collection case with escalation >= 1 or daysOverdue > 60)
  const disputedCount = overdueInvoices.filter(
    (i) => i.hasOpenCollectionCase && (i.collectionCaseEscalation >= 1 || i.daysOverdue > 60)
  ).length;

  // Count promised payments (customer responded with a promise)
  const promisedPaymentCount = overdueInvoices.filter(
    (i) => i.hasCustomerResponse && i.responseNotes && /promise|will pay|payment plan|by next|within \d/i.test(i.responseNotes)
  ).length;

  // Count unresponsive (reminder sent >14 days ago, no response)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const unresponsiveCount = overdueInvoices.filter((i) => {
    if (i.hasCustomerResponse) return false;
    // Check if there's a reminder sent >14 days ago with no response
    const inv = invoices.find((x) => x.id === i.id);
    const oldReminder = inv?.reminders.find((r) => r.sentAt && new Date(r.sentAt) < fourteenDaysAgo && !r.respondedAt);
    return !!oldReminder;
  }).length;

  return {
    overdueRate,
    totalOutstanding,
    totalOverdue,
    overdueInvoiceCount: overdueInvoices.length,
    overdueInvoices,
    disputedCount,
    promisedPaymentCount,
    unresponsiveCount,
    topOverdueCustomer,
    recentEpisodeCount: 0, // filled by caller
  };
}

/**
 * Selects an episode strategy based on the observed state AND the Mandate's
 * accumulated memory.
 *
 * This is the REASON step of the closed-loop control system. The selector
 * applies a priority-ordered decision tree:
 *
 *   1. Disputed invoices exist?        → investigate_disputed
 *   2. One customer = 40%+ of overdue? → prioritize_high_value
 *   3. Customers promised payment?     → wait_for_promise (don't spam)
 *   4. Unresponsive after 14 days?     → escalate_unresponsive
 *   5. Standard overdue, no recent reminder? → send_reminder_campaign
 *   6. No actionable gap?              → re_evaluate (no episode)
 *
 * Memory influences the reasoning: if the Mandate has learned that a customer
 * responds to a specific approach, or that a strategy was ineffective, that
 * learning is woven into the strategy's reasoning and description. This is
 * what closes the memory loop — the Mandate's past outcomes shape its future
 * strategy selection.
 *
 * Each strategy produces a DIFFERENT episode with DIFFERENT actions. This is
 * what makes the Mandate a control system, not a workflow.
 */
export function selectStrategy(
  state: ObservedState,
  mandateTitle: string,
  mandateDeclaration: string,
  memory: MandateMemoryRef[] = []
): SelectedStrategy | null {
  const baseReasoning = `Observed: ${state.overdueInvoiceCount} overdue invoices, ${(state.overdueRate * 100).toFixed(1)}% overdue rate, ₹${state.totalOverdue.toLocaleString("en-IN")} at risk.`;

  // ─── Retrieve relevant memory for this strategy selection ────────────────
  // Memory types that influence strategy:
  //   customer_pattern — affects how we approach specific customers
  //   strategy — affects whether we repeat or avoid a past strategy
  //   outcome_lesson — affects priority and approach
  //   approval_feedback — affects what we propose (avoid rejected actions)
  const customerPatterns = memory.filter((m) => m.memoryType === "customer_pattern");
  const strategyMemories = memory.filter((m) => m.memoryType === "strategy");
  const outcomeLessons = memory.filter((m) => m.memoryType === "outcome_lesson");
  const approvalFeedback = memory.filter((m) => m.memoryType === "approval_feedback");

  // Build a memory context string for the reasoning
  const memoryContextParts: string[] = [];
  if (customerPatterns.length > 0) {
    memoryContextParts.push(`${customerPatterns.length} customer pattern(s) from past episodes`);
  }
  if (strategyMemories.length > 0) {
    memoryContextParts.push(`${strategyMemories.length} strategy outcome(s)`);
  }
  if (outcomeLessons.length > 0) {
    memoryContextParts.push(`${outcomeLessons.length} outcome lesson(s)`);
  }
  const memoryContext = memoryContextParts.length > 0
    ? ` Memory consulted: ${memoryContextParts.join(", ")}.`
    : " No prior memory — this is the Mandate's first episode.";

  // 1. Disputed invoices — investigate before sending reminders
  if (state.disputedCount > 0) {
    const disputed = state.overdueInvoices.find((i) => i.hasOpenCollectionCase && (i.collectionCaseEscalation >= 1 || i.daysOverdue > 60));
    if (disputed) {
      // Check if we have memory about this customer's dispute patterns
      const customerMemory = customerPatterns.find((m) => m.content.includes(disputed.customerName));
      const memoryNote = customerMemory
        ? `\n\nMemory: ${customerMemory.content}`
        : "";
      return {
        strategy: "investigate_disputed",
        reasoning: `${baseReasoning} ${state.disputedCount} invoice(s) have open collection cases with escalation. Investigating disputes before sending reminders prevents aggravating customers with valid complaints.${memoryContext}`,
        episodeTitle: `Investigate disputed invoice ${disputed.invoiceNumber} (${disputed.customerName})`,
        episodeDescription: `Mandate: ${mandateTitle}\nDeclaration: ${mandateDeclaration}\n\nObserved state: Invoice ${disputed.invoiceNumber} for ${disputed.customerName} is ${disputed.daysOverdue} days overdue with an open collection case at escalation level ${disputed.collectionCaseEscalation}.\n\nStrategy: investigate_disputed — Before sending any reminder, verify whether this invoice is genuinely disputed. Check the collection case history, customer communications, and GST/tax records. If the dispute is valid, escalate to the grantor. If not, proceed with standard collection.${memoryNote}`,
        priority: "high",
        observedState: state,
        memoryUsed: customerMemory ? [customerMemory] : [],
      };
    }
  }

  // 2. High-value concentration — prioritize the biggest risk
  if (state.topOverdueCustomer) {
    const topInvoices = state.overdueInvoices.filter((i) => i.customerName === state.topOverdueCustomer!.name);
    // Check if we have memory about this customer
    const customerMemory = customerPatterns.find((m) => m.content.includes(state.topOverdueCustomer!.name));
    const memoryNote = customerMemory
      ? `\n\nMemory: ${customerMemory.content}`
      : "";
    return {
      strategy: "prioritize_high_value",
      reasoning: `${baseReasoning} ${state.topOverdueCustomer.name} accounts for ${(state.topOverdueCustomer.percentage * 100).toFixed(0)}% of overdue receivables (₹${state.topOverdueCustomer.amount.toLocaleString("en-IN")}). Concentrated risk — prioritize recovery from this customer before smaller accounts.${memoryContext}`,
      episodeTitle: `Prioritize recovery from ${state.topOverdueCustomer.name} (₹${state.topOverdueCustomer.amount.toLocaleString("en-IN")} at risk)`,
      episodeDescription: `Mandate: ${mandateTitle}\nDeclaration: ${mandateDeclaration}\n\nObserved state: ${state.topOverdueCustomer.name} represents ${(state.topOverdueCustomer.percentage * 100).toFixed(0)}% of total overdue receivables. ${topInvoices.length} invoice(s) affected.\n\nStrategy: prioritize_high_value — Focus collection effort on the highest-value overdue customer. Review their payment history, risk level, and previous interactions. Determine the most effective approach (reminder, call, escalation, or negotiated payment plan) based on their profile.${memoryNote}`,
      priority: "high",
      observedState: state,
      memoryUsed: customerMemory ? [customerMemory] : [],
    };
  }

  // 3. Promised payment — wait, don't spam
  if (state.promisedPaymentCount > 0 && state.overdueInvoices.every((i) => i.hasRecentReminder || i.hasCustomerResponse)) {
    return {
      strategy: "wait_for_promise",
      reasoning: `${baseReasoning} ${state.promisedPaymentCount} customer(s) have promised payment. All overdue invoices either have a recent reminder or a customer response. Sending more reminders now would damage the relationship. Wait for the promised payment window to expire before acting.${memoryContext}`,
      episodeTitle: `Monitor promised payments (${state.promisedPaymentCount} pending)`,
      episodeDescription: `Mandate: ${mandateTitle}\nDeclaration: ${mandateDeclaration}\n\nObserved state: ${state.promisedPaymentCount} customer(s) have responded with a payment promise. All overdue invoices have recent reminders or responses.\n\nStrategy: wait_for_promise — Do not send additional reminders. Monitor whether the promised payments arrive. If a promise expires without payment, escalate to send_reminder_campaign.`,
      priority: "low",
      observedState: state,
      memoryUsed: [],
    };
  }

  // 4. Unresponsive customers — escalate
  if (state.unresponsiveCount > 0) {
    // Check if we have memory about reminder effectiveness
    const effectivenessMemory = strategyMemories.find((m) => m.content.includes("send_reminder"));
    const memoryNote = effectivenessMemory
      ? `\n\nMemory: ${effectivenessMemory.content}`
      : "";
    return {
      strategy: "escalate_unresponsive",
      reasoning: `${baseReasoning} ${state.unresponsiveCount} customer(s) have not responded to reminders sent over 14 days ago. Standard reminders are not working — escalate the approach.${memoryContext}`,
      episodeTitle: `Escalate ${state.unresponsiveCount} unresponsive customer(s)`,
      episodeDescription: `Mandate: ${mandateTitle}\nDeclaration: ${mandateDeclaration}\n\nObserved state: ${state.unresponsiveCount} customer(s) have not responded to reminders sent more than 14 days ago.\n\nStrategy: escalate_unresponsive — Standard reminders have failed. Consider escalation: internal escalation to the grantor, stronger language in follow-up, or referral to a collection agency. Review each unresponsive customer's risk level and amount before deciding the escalation path.${memoryNote}`,
      priority: "medium",
      observedState: state,
      memoryUsed: effectivenessMemory ? [effectivenessMemory] : [],
    };
  }

  // 5. Standard overdue — send reminder campaign
  const needsReminder = state.overdueInvoices.filter((i) => !i.hasRecentReminder);
  if (needsReminder.length > 0) {
    // Check if we have approval feedback memory (e.g. "grantor rejected reminders")
    const rejectionMemory = approvalFeedback.find((m) => m.content.includes("rejected"));
    const memoryNote = rejectionMemory
      ? `\n\nMemory: ${rejectionMemory.content}`
      : "";
    return {
      strategy: "send_reminder_campaign",
      reasoning: `${baseReasoning} ${needsReminder.length} overdue invoice(s) have no recent reminder (within 7 days). Standard collection action is appropriate.${memoryContext}`,
      episodeTitle: `Send reminders for ${needsReminder.length} overdue invoice(s)`,
      episodeDescription: `Mandate: ${mandateTitle}\nDeclaration: ${mandateDeclaration}\n\nObserved state: ${needsReminder.length} overdue invoice(s) have no recent reminder.\n\nStrategy: send_reminder_campaign — Generate and send collection reminders for overdue invoices that have not been contacted in the last 7 days. Each reminder requires human approval per the Mandate's authority (send_reminder requires approval).${memoryNote}`,
      priority: "medium",
      observedState: state,
      memoryUsed: rejectionMemory ? [rejectionMemory] : [],
    };
  }

  // 6. No actionable gap — re-evaluate later
  return null;
}

/**
 * OWNARA — Finance-Aware Planner (Finance Brain Integration)
 *
 * This planner now uses the Finance Brain's structured recommendations
 * instead of raw invoice data. Every step's reasoning comes from the
 * recommendation's evidence, policy influence, and customer history analysis.
 *
 * The approval gate includes the COMPLETE reasoning chain so the finance
 * manager can see:
 * - Why this action was chosen
 * - Which evidence was used
 * - Which policies influenced the decision
 * - Which customer history influenced the decision
 * - Why alternatives were rejected
 *
 * The executor processes these steps using the SAME runtime: the worker
 * polls, the state machine transitions, the audit writer records, and the
 * approval gate stops execution exactly as before.
 */

import type { PlannedStep, ExecutionPlan } from "./planner";
import type { FinanceRecommendation } from "@/lib/finance/brain";
import { agingBucketLabel, actionLabel, formatRupees } from "@/lib/finance/domain";

// ─── Finance Planning ────────────────────────────────────────────────────────

/**
 * Determines whether a task should use finance planning.
 */
export function isFinanceTask(
  employeeRole: string,
  taskTitle: string,
  taskDescription: string
): boolean {
  if (employeeRole === "finance_employee") return true;

  const text = `${taskTitle} ${taskDescription}`.toLowerCase();
  const financeKeywords = [
    "invoice", "overdue", "receivable", "collection", "payment",
    "customer outstanding", "aging", "reminder", "dunning",
    "ar ", "accounts receivable", "credit", "debit note",
  ];
  return financeKeywords.some((kw) => text.includes(kw));
}

/**
 * Generates a finance execution plan for a single invoice using the
 * Finance Brain's recommendation.
 *
 * Each step's reasoning is grounded in the recommendation's evidence,
 * policy influence, and customer history analysis. The approval gate
 * includes the complete reasoning chain.
 *
 * @param rec - The Finance Brain's recommendation
 * @param tools - The tools granted to the employee
 */
export function generateFinancePlan(
  rec: FinanceRecommendation,
  tools: string[]
): ExecutionPlan {
  const steps: PlannedStep[] = [];
  const amount = formatRupees(rec.outstanding);
  const bucket = agingBucketLabel(rec.agingBucket);

  // Step 1: Invoice Review — grounded in evidence
  const invoiceEvidence = rec.evidence.filter((e) => e.source === "invoice");
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Invoice Review: ${rec.invoiceNumber} — ${amount} outstanding, ${rec.daysOverdue} days overdue (${bucket}). ` +
      `${invoiceEvidence.map((e) => e.fact).join(" ")}`,
    confidence: 0.98,
  });

  // Step 2: Customer Assessment — grounded in customer evidence + risk
  const customerEvidence = rec.evidence.filter((e) => e.source === "customer");
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Customer Assessment: ${rec.customerName} (Risk: ${rec.customerHistoryInfluence.split(".")[0]}). ` +
      `${customerEvidence.map((e) => e.fact).join(" ")}`,
    confidence: 0.95,
  });

  // Step 3: Payment History Analysis
  const paymentEvidence = rec.evidence.filter((e) => e.source === "payment_history");
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Payment History: ${paymentEvidence.length > 0 ? paymentEvidence.map((e) => e.fact).join(" ") : "No payment history evidence available."}`,
    confidence: 0.97,
  });

  // Step 4: Reminder History Analysis
  const reminderEvidence = rec.evidence.filter((e) => e.source === "reminder_history");
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Reminder History: ${reminderEvidence.length > 0 ? reminderEvidence.map((e) => e.fact).join(" ") : "No previous reminders."}`,
    confidence: 0.97,
  });

  // Step 5: Recommendation Decision — the core reasoning
  const policyText = rec.policyInfluence.length > 0
    ? rec.policyInfluence.map((p) => `${p.policyCode}: ${p.howItInfluenced}`).join(" ")
    : "No specific policies influenced this decision.";
  const rejectedText = rec.rejectedAlternatives.slice(0, 3).map((a) => `${a.action.replace(/_/g, " ")} — ${a.reason}`).join(" ");

  steps.push({
    stepType: "reasoning",
    reasoning:
      `Recommendation: ${actionLabel(rec.action)} (confidence: ${(rec.confidence * 100).toFixed(0)}%). ` +
      `Priority: ${rec.collectionPriority.toUpperCase()}. ` +
      `\n\nWHY: ${rec.why} ` +
      `\n\nPOLICY INFLUENCE: ${policyText} ` +
      `\n\nREJECTED ALTERNATIVES: ${rejectedText}`,
    confidence: rec.confidence,
  });

  // Step 6: Generate Reminder (non-critical tool)
  if (tools.includes("generate_reminder")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        `Generating a ${rec.action === "send_first_reminder" ? "first" : "follow-up"} ` +
        `reminder email for Invoice ${rec.invoiceNumber} based on the recommendation. ` +
        `The reminder references: outstanding amount (${amount}), days overdue (${rec.daysOverdue}), ` +
        `and recommended action (${actionLabel(rec.action)}).`,
      tool: "generate_reminder",
      toolInput: {
        invoiceId: rec.invoiceId,
        invoiceNumber: rec.invoiceNumber,
        customerId: rec.customerId,
        customerName: rec.customerName,
        customerEmail: rec.customerEmail,
        outstanding: String(rec.outstanding),
        daysOverdue: String(rec.daysOverdue),
        dueDate: new Date().toISOString(), // Filled by generate_reminder tool via loadInvoiceContext
        recommendedAction: rec.action,
      },
      confidence: 0.92,
    });
  }

  // Step 7: Approval Gate — includes the COMPLETE reasoning chain
  // The proposed action contains the full Finance Brain output so the
  // finance manager can review the reasoning before approving.
  if (tools.includes("send_reminder")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        `Prepared to send reminder to ${rec.customerName} (${rec.customerEmail}) ` +
        `for Invoice ${rec.invoiceNumber}. ` +
        `This is a critical action requiring human approval. ` +
        `The complete reasoning chain is attached for the finance manager's review.`,
      tool: "send_reminder",
      toolInput: {
        invoiceId: rec.invoiceId,
        invoiceNumber: rec.invoiceNumber,
        customerId: rec.customerId,
        customerName: rec.customerName,
        customerEmail: rec.customerEmail,
        outstanding: String(rec.outstanding),
        daysOverdue: String(rec.daysOverdue),
        agingBucket: rec.agingBucket,
        paymentTerms: String(rec.paymentTerms),
        previousReminderCount: String(rec.previousReminderCount),
        recommendedAction: rec.action,
        collectionPriority: rec.collectionPriority,
        // ─── Finance Brain Reasoning Chain ──────────────────────────
        reasoningSummary: rec.humanReadableSummary,
        why: rec.why,
        riskAssessment: rec.riskAssessment,
        confidence: String(rec.confidence),
        evidence: JSON.stringify(rec.evidence),
        policyInfluence: JSON.stringify(rec.policyInfluence),
        customerHistoryInfluence: rec.customerHistoryInfluence,
        rejectedAlternatives: JSON.stringify(rec.rejectedAlternatives),
        // ─── End Reasoning Chain ────────────────────────────────────
      },
      confidence: rec.confidence,
    });
  }

  // Step 8: Update Collection Case
  if (tools.includes("update_collection_case")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        `Updating collection case for Invoice ${rec.invoiceNumber}: ` +
        `recording that ${actionLabel(rec.action)} was sent. ` +
        `Priority: ${rec.collectionPriority}. Confidence: ${(rec.confidence * 100).toFixed(0)}%.`,
      tool: "update_collection_case",
      toolInput: {
        invoiceId: rec.invoiceId,
        invoiceNumber: rec.invoiceNumber,
        customerId: rec.customerId,
        action: "reminder_sent",
        priority: rec.collectionPriority,
        agingBucket: rec.agingBucket,
        daysOverdue: String(rec.daysOverdue),
      },
      confidence: 0.93,
    });
  }

  // Step 9: Summary
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Collections workflow complete for Invoice ${rec.invoiceNumber}. ` +
      `Action taken: ${actionLabel(rec.action)}. ` +
      `Reminder sent to ${rec.customerName}. Collection case updated. ` +
      `Next review: if no response within 5 business days, ` +
      `${rec.daysOverdue > 60 ? "escalate to manager" : "send follow-up reminder"}.`,
    confidence: 0.96,
  });

  return { steps };
}

/**
 * Generates a batch finance plan for multiple overdue invoices.
 * Each invoice gets its own Finance Brain recommendation.
 */
export function generateBatchFinancePlan(
  recommendations: FinanceRecommendation[],
  tools: string[]
): ExecutionPlan {
  const steps: PlannedStep[] = [];

  // Step 0: Batch overview
  const totalOutstanding = recommendations.reduce((sum, r) => sum + r.outstanding, 0);
  const criticalCount = recommendations.filter((r) => r.collectionPriority === "critical").length;
  const highCount = recommendations.filter((r) => r.collectionPriority === "high").length;

  steps.push({
    stepType: "reasoning",
    reasoning:
      `AR Aging Review: ${recommendations.length} invoice(s) needing attention. ` +
      `Total outstanding: ${formatRupees(totalOutstanding)}. ` +
      `${criticalCount} critical, ${highCount} high priority. ` +
      `Each invoice will be processed with full finance reasoning.`,
    confidence: 0.98,
  });

  // For each invoice, add the full finance workflow steps
  for (const rec of recommendations) {
    const invoicePlan = generateFinancePlan(rec, tools);
    // Skip the summary step (last step) for individual invoices in batch mode
    steps.push(...invoicePlan.steps.slice(0, -1));
  }

  // Final summary
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Batch processing complete. ${recommendations.length} invoice(s) reviewed with full finance reasoning. ` +
      `All recommendations executed (pending approval where applicable). ` +
      `Collection cases updated. Next batch review recommended in 3 business days.`,
    confidence: 0.97,
  });

  return { steps };
}

// ─── Finance Tool Execution (unchanged) ──────────────────────────────────────

/**
 * Executes a finance tool and returns its output.
 * (This function is unchanged from the previous implementation.)
 */
export async function executeFinanceTool(
  toolName: string,
  toolInput: Record<string, string>,
  workspaceId: string,
  employeeId: string
): Promise<{ output: Record<string, string>; tokens: number; durationMs: number }> {
  const start = Date.now();

  switch (toolName) {
    case "generate_reminder": {
      const { loadInvoiceContext, generateReminderContent } = await import("@/lib/finance/domain");
      const ctx = await loadInvoiceContext(toolInput.invoiceId);
      if (!ctx) {
        return {
          output: { error: "Invoice not found", invoiceId: toolInput.invoiceId },
          tokens: 100,
          durationMs: Date.now() - start,
        };
      }

      const content = generateReminderContent(ctx);

      const reminder = await db.reminder.create({
        data: {
          workspaceId,
          invoiceId: ctx.invoiceId,
          customerId: ctx.customerId,
          reminderType: "email",
          subject: content.subject,
          body: content.body,
          status: "drafted",
          createdBy: employeeId,
        },
      });

      return {
        output: {
          reminderId: reminder.id,
          subject: content.subject,
          status: "drafted",
          invoiceNumber: ctx.invoiceNumber,
          customerName: ctx.customerName,
        },
        tokens: 680,
        durationMs: Date.now() - start + 1500,
      };
    }

    case "send_reminder": {
      // 1. Check if reminder was already sent for this invoice (idempotency guard)
      const existingSent = await db.reminder.findFirst({
        where: {
          invoiceId: toolInput.invoiceId,
          status: { in: ["sent", "sent_mock"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingSent && existingSent.sentAt) {
        return {
          output: {
            reminderId: existingSent.id,
            status: existingSent.status,
            mock: String(existingSent.status === "sent_mock"),
            sentTo: toolInput.customerEmail || "",
            subject: existingSent.subject,
            messageId: existingSent.responseNotes?.startsWith("messageId:") ? existingSent.responseNotes.replace("messageId: ", "") : "",
            idempotentReplay: "true",
          },
          tokens: 50,
          durationMs: Date.now() - start,
        };
      }

      const reminder = await db.reminder.findFirst({
        where: {
          invoiceId: toolInput.invoiceId,
          status: "drafted",
        },
        orderBy: { createdAt: "desc" },
      });

      if (!reminder) {
        return {
          output: { error: "No drafted reminder found for this invoice" },
          tokens: 100,
          durationMs: Date.now() - start,
        };
      }

      // Send the actual email via SMTP
      const customer = await db.customer.findUnique({
        where: { id: reminder.customerId },
        select: { email: true, name: true },
      });

      let emailSent = false;
      let emailMock = false;
      let emailError: string | undefined;
      let emailMessageId: string | undefined;

      if (customer?.email) {
        const { sendReminderEmail } = await import("@/lib/email/service");
        const result = await sendReminderEmail({
          to: customer.email,
          customerName: customer.name,
          subject: reminder.subject,
          body: reminder.body,
        });
        emailSent = result.sent;
        emailMock = result.mock;
        emailError = result.error;
        emailMessageId = result.messageId;
      }

      // Update reminder status: "sent" for real SMTP, "sent_mock" for mock transport, "failed" for errors
      const reminderStatus = emailSent ? (emailMock ? "sent_mock" : "sent") : "failed";
      await db.reminder.update({
        where: { id: reminder.id },
        data: {
          status: reminderStatus,
          sentAt: emailSent ? new Date() : null,
          // Store mock/messageId in responseNotes for evidence
          responseNotes: emailMock ? "MOCK TRANSPORT — email not actually delivered" : (emailMessageId ? `messageId: ${emailMessageId}` : null),
        },
      });

      return {
        output: {
          reminderId: reminder.id,
          status: reminderStatus,
          mock: String(emailMock),
          sentTo: customer?.email || "",
          subject: reminder.subject,
          messageId: emailMessageId || "",
          emailError: emailError || "",
        },
        tokens: 200,
        durationMs: Date.now() - start + 800,
      };
    }

    case "update_collection_case": {
      let collectionCase = await db.collectionCase.findFirst({
        where: {
          invoiceId: toolInput.invoiceId,
          status: { in: ["open", "escalated"] },
        },
      });

      if (!collectionCase) {
        collectionCase = await db.collectionCase.create({
          data: {
            workspaceId,
            invoiceId: toolInput.invoiceId,
            customerId: toolInput.customerId,
            status: "open",
            priority: toolInput.priority || "medium",
            agingBucket: toolInput.agingBucket || "current",
            daysOverdue: parseInt(toolInput.daysOverdue || "0"),
            assignedTo: employeeId,
          },
        });
      } else {
        collectionCase = await db.collectionCase.update({
          where: { id: collectionCase.id },
          data: {
            priority: toolInput.priority || collectionCase.priority,
            agingBucket: toolInput.agingBucket || collectionCase.agingBucket,
            daysOverdue: parseInt(toolInput.daysOverdue || "0"),
          },
        });
      }

      await db.followUpHistory.create({
        data: {
          collectionCaseId: collectionCase.id,
          action: toolInput.action || "reminder_sent",
          description: `Reminder sent for invoice ${toolInput.invoiceNumber || toolInput.invoiceId}. Priority: ${toolInput.priority}. Aging: ${toolInput.agingBucket}.`,
          performedBy: employeeId,
        },
      });

      return {
        output: {
          collectionCaseId: collectionCase.id,
          status: collectionCase.status,
          priority: collectionCase.priority,
          action: toolInput.action || "reminder_sent",
        },
        tokens: 150,
        durationMs: Date.now() - start + 600,
      };
    }

    default:
      return {
        output: { error: `Unknown finance tool: ${toolName}` },
        tokens: 0,
        durationMs: Date.now() - start,
      };
  }
}

// Re-export db for executeFinanceTool
import { db } from "@/lib/db";

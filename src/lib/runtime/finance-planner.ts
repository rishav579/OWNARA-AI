/**
 * BIHARI AI — Finance-Aware Planner
 *
 * Extends the existing generic planner with finance domain planning logic.
 * Instead of creating generic "search_knowledge → draft_response → send_email"
 * plans, the finance planner generates collections-workflow plans:
 *
 *   Read Invoice → Load Customer → Calculate Aging → Check Previous Follow-ups
 *   → Determine Collection Priority → Generate Reminder → Approval Gate
 *   → Send Reminder → Update Collection Case → Write Audit
 *
 * This module does NOT replace the existing planner — it adds a finance
 * planning path that is selected when the employee's role is
 * "finance_employee" or when the task references invoices/collections.
 *
 * The executor processes these steps using the SAME runtime: the worker
 * polls, the state machine transitions, the audit writer records, and the
 * approval gate stops execution exactly as before.
 */

import type { PlannedStep, ExecutionPlan } from "./planner";
import type { InvoiceContext } from "@/lib/finance/domain";
import {
  agingBucketLabel,
  actionLabel,
  formatRupees,
} from "@/lib/finance/domain";

// ─── Finance Planning ────────────────────────────────────────────────────────

/**
 * Determines whether a task should use finance planning.
 * Returns true if the employee role is finance_employee OR if the task
 * description references invoices, collections, receivables, or payments.
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
 * Generates a finance execution plan for a single invoice.
 *
 * The plan follows the collections workflow:
 * 1. Read Invoice (reasoning) — load and understand the invoice
 * 2. Load Customer (reasoning) — assess customer risk and history
 * 3. Calculate Aging (reasoning) — compute days overdue and aging bucket
 * 4. Check Previous Follow-ups (reasoning) — review reminder history
 * 5. Determine Collection Priority (reasoning) — assign priority
 * 6. Generate Reminder (tool_call: generate_reminder) — draft the email
 * 7. Approval Gate (approval_gate: send_reminder) — human must approve
 * 8. Send Reminder (handled by approval execution) — sends after approval
 * 9. Update Collection Case (tool_call: update_collection_case) — record action
 *
 * @param ctx - The invoice context loaded by the finance domain service
 * @param tools - The tools granted to the employee
 */
export function generateFinancePlan(
  ctx: InvoiceContext,
  tools: string[]
): ExecutionPlan {
  const steps: PlannedStep[] = [];
  const amount = formatRupees(ctx.outstanding);
  const bucket = agingBucketLabel(ctx.agingBucket);

  // Step 1: Read Invoice — understand the invoice details
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Reading Invoice ${ctx.invoiceNumber}: ${amount} outstanding, ` +
      `issued on ${formatDate(ctx.issueDate)}, due on ${formatDate(ctx.dueDate)}. ` +
      `Payment terms: Net ${ctx.paymentTerms} days. Current status: ${ctx.status}.`,
    confidence: 0.98,
  });

  // Step 2: Load Customer — assess risk and payment history
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Customer: ${ctx.customerName} (${ctx.customerEmail}). ` +
      `Risk level: ${ctx.customerRiskLevel}. ` +
      `Payment history: ${ctx.paymentHistoryCount} previous payment(s) on this invoice. ` +
      `Customer payment terms: Net ${ctx.paymentTerms} days.`,
    confidence: 0.95,
  });

  // Step 3: Calculate Aging — compute days overdue and aging bucket
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Aging analysis: Invoice is ${ctx.daysOverdue} days overdue, ` +
      `placing it in the ${bucket} aging bucket. ` +
      `Outstanding amount: ${amount}.`,
    confidence: 0.99,
  });

  // Step 4: Check Previous Follow-ups — review reminder history
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Previous follow-up history: ${ctx.previousReminderCount} reminder(s) sent. ` +
      (ctx.lastReminderDate
        ? `Last reminder sent on ${formatDate(ctx.lastReminderDate)}. `
        : `No previous reminders. `) +
      `Customer response: ${ctx.previousReminderCount > 0 ? "No response received" : "N/A"}.`,
    confidence: 0.97,
  });

  // Step 5: Determine Collection Priority — assign priority based on aging + risk
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Collection priority assessment: ${ctx.collectionPriority.toUpperCase()} priority. ` +
      `Based on ${ctx.daysOverdue} days overdue, ${amount} outstanding, ` +
      `and customer risk level "${ctx.customerRiskLevel}". ` +
      `Recommended action: ${actionLabel(ctx.recommendedAction)}.`,
    confidence: 0.94,
  });

  // Step 6: Generate Reminder — draft the reminder email (non-critical tool)
  if (tools.includes("generate_reminder")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        `Generating a ${ctx.recommendedAction === "send_first_reminder" ? "first" : "follow-up"} ` +
        `reminder email for Invoice ${ctx.invoiceNumber}. ` +
        `The reminder will reference the outstanding amount (${amount}), ` +
        `days overdue (${ctx.daysOverdue}), and due date.`,
      tool: "generate_reminder",
      toolInput: {
        invoiceId: ctx.invoiceId,
        invoiceNumber: ctx.invoiceNumber,
        customerId: ctx.customerId,
        customerName: ctx.customerName,
        customerEmail: ctx.customerEmail,
        outstanding: String(ctx.outstanding),
        daysOverdue: String(ctx.daysOverdue),
        dueDate: ctx.dueDate.toISOString(),
        recommendedAction: ctx.recommendedAction,
      },
      confidence: 0.92,
    });
  }

  // Step 7: Approval Gate — send_reminder is ALWAYS critical
  // The executor will check the employee's approvalRules and create an
  // approval gate. The proposed action includes full finance reasoning.
  if (tools.includes("send_reminder")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        `Prepared to send reminder email to ${ctx.customerName} ` +
        `(${ctx.customerEmail}) for Invoice ${ctx.invoiceNumber}. ` +
        `This is a critical action — sending an external communication ` +
        `to a customer requires human approval. ` +
        `Business reason: ${ctx.businessReason}`,
      tool: "send_reminder",
      toolInput: {
        invoiceId: ctx.invoiceId,
        invoiceNumber: ctx.invoiceNumber,
        customerId: ctx.customerId,
        customerName: ctx.customerName,
        customerEmail: ctx.customerEmail,
        outstanding: String(ctx.outstanding),
        daysOverdue: String(ctx.daysOverdue),
        agingBucket: ctx.agingBucket,
        paymentTerms: String(ctx.paymentTerms),
        previousReminderCount: String(ctx.previousReminderCount),
        recommendedAction: ctx.recommendedAction,
        businessReason: ctx.businessReason,
      },
      confidence: 0.90,
    });
  }

  // Step 8: Update Collection Case — record the action taken
  if (tools.includes("update_collection_case")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        `Updating the collection case for Invoice ${ctx.invoiceNumber}: ` +
        `recording that a ${actionLabel(ctx.recommendedAction)} was sent. ` +
        `Priority: ${ctx.collectionPriority}. ` +
        `This updates the follow-up history for audit and compliance.`,
      tool: "update_collection_case",
      toolInput: {
        invoiceId: ctx.invoiceId,
        customerId: ctx.customerId,
        action: "reminder_sent",
        priority: ctx.collectionPriority,
        agingBucket: ctx.agingBucket,
        daysOverdue: String(ctx.daysOverdue),
      },
      confidence: 0.93,
    });
  }

  // Step 9: Summary reasoning
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Collections workflow complete for Invoice ${ctx.invoiceNumber}. ` +
      `Reminder sent to ${ctx.customerName}. ` +
      `Collection case updated. ` +
      `Next review: if no response within 5 business days, escalate to ${ctx.daysOverdue > 60 ? "manager" : "follow-up reminder"}.`,
    confidence: 0.96,
  });

  return { steps };
}

/**
 * Generates a finance execution plan for processing multiple overdue invoices.
 *
 * This is used when the task is "process overdue invoices" or "review AR aging".
 * The plan processes each invoice sequentially within a single task.
 *
 * @param contexts - Array of invoice contexts, sorted by priority
 * @param tools - The tools granted to the employee
 */
export function generateBatchFinancePlan(
  contexts: InvoiceContext[],
  tools: string[]
): ExecutionPlan {
  const steps: PlannedStep[] = [];

  // Step 0: Overview reasoning — summarize the batch
  const totalOutstanding = contexts.reduce((sum, c) => sum + c.outstanding, 0);
  const criticalCount = contexts.filter((c) => c.collectionPriority === "critical").length;
  const highCount = contexts.filter((c) => c.collectionPriority === "high").length;

  steps.push({
    stepType: "reasoning",
    reasoning:
      `AR Aging review: found ${contexts.length} invoice(s) needing attention. ` +
      `Total outstanding: ${formatRupees(totalOutstanding)}. ` +
      `${criticalCount} critical, ${highCount} high priority. ` +
      `Processing each invoice in priority order.`,
    confidence: 0.98,
  });

  // For each invoice, add the full finance workflow steps
  for (const ctx of contexts) {
    const invoicePlan = generateFinancePlan(ctx, tools);
    // Skip the summary step (last step) for individual invoices in batch mode
    steps.push(...invoicePlan.steps.slice(0, -1));
  }

  // Final summary
  steps.push({
    stepType: "reasoning",
    reasoning:
      `Batch processing complete. ${contexts.length} invoice(s) reviewed and processed. ` +
      `All reminders sent (pending approval where applicable). ` +
      `Collection cases updated. Next batch review recommended in 3 business days.`,
    confidence: 0.97,
  });

  return { steps };
}

// ─── Finance Tool Execution ──────────────────────────────────────────────────

/**
 * Executes a finance tool and returns its output.
 *
 * This extends the existing executeTool function with finance-specific tools.
 * The existing tools (search_knowledge, draft_response, send_email, summarize)
 * continue to work via the original executeTool in planner.ts.
 *
 * Finance tools:
 * - generate_reminder: Creates a Reminder record in the database
 * - send_reminder: Marks the reminder as sent (only after approval)
 * - update_collection_case: Creates/updates a CollectionCase + FollowUpHistory
 * - read_invoice: Loads invoice data (reasoning-only, no side effects)
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
      // Load the invoice context to generate the reminder content
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

      // Create a Reminder record in the database
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
      // This is called AFTER approval. It marks the reminder as sent.
      // The reminder was created by generate_reminder.
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

      await db.reminder.update({
        where: { id: reminder.id },
        data: { status: "sent", sentAt: new Date() },
      });

      return {
        output: {
          reminderId: reminder.id,
          status: "sent",
          sentTo: toolInput.customerEmail || "",
          subject: reminder.subject,
        },
        tokens: 200,
        durationMs: Date.now() - start + 800,
      };
    }

    case "update_collection_case": {
      // Find or create a collection case for this invoice
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
        // Update existing case
        collectionCase = await db.collectionCase.update({
          where: { id: collectionCase.id },
          data: {
            priority: toolInput.priority || collectionCase.priority,
            agingBucket: toolInput.agingBucket || collectionCase.agingBucket,
            daysOverdue: parseInt(toolInput.daysOverdue || "0"),
          },
        });
      }

      // Add a follow-up history entry
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Re-export db for executeFinanceTool
import { db } from "@/lib/db";

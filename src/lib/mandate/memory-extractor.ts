/**
 * BIHARI AI — Mandate Memory Extractor
 *
 * The mechanism whereby completed episodes produce durable Mandate-level
 * learning. This is NOT "store every event." It is a deterministic,
 * evidence-based pipeline:
 *
 *   OBSERVATION  → read the episode's outcome (completed/failed, what happened)
 *   EVIDENCE     → verify the outcome is backed by concrete artifacts (steps,
 *                  audit entries, reminders, payments)
 *   CANDIDATE    → propose a learning based on the episode type + outcome
 *   VALIDATION   → check the candidate is supported by sufficient evidence
 *   MEMORY       → store with full provenance (episodeId, confidence, createdAt)
 *
 * Every memory entry can answer:
 *   • Why does this Mandate remember this?  → sourceType + sourceId
 *   • Which episode produced it?            → sourceId (the task ID)
 *   • When was it learned?                  → createdAt
 *   • How confident is it?                  → importance (0-1)
 *   • Can it be invalidated?                → supersededAt (nullable)
 *
 * The memory is scoped to the MANDATE, not the tenant. When the tenant is
 * replaced, the new tenant inherits this accumulated judgment. This is the
 * architectural property that makes the Mandate survive executor replacement
 * with its learning intact.
 */

import { db } from "@/lib/db";
import { appendMandateMemory } from "@/lib/mandate/engine";

interface EpisodeOutcome {
  taskId: string;
  mandateId: string;
  workspaceId: string;
  status: string;
  strategy: string | null;
  stepCount: number;
  completedStepCount: number;
  failedStepCount: number;
  approvalRejections: number;
  tokenUsage: number;
  outcomeSummary: string | null;
  remindersCreated: number;
  remindersSent: number;
  customerResponses: number;
  paymentsReceived: number;
}

/**
 * Extracts learnings from a completed episode and stores them as Mandate memory.
 *
 * Called after the learning engine's evaluateAndLearn (for completed tasks) or
 * evaluateAndLearnFailure (for failed tasks). Best-effort — never blocks the
 * completion path.
 *
 * The extraction is DETERMINISTIC: the same episode outcome always produces
 * the same candidate learnings. No LLM guessing. This guarantees
 * reproducibility and auditability.
 */
export async function extractMandateMemoryFromEpisode(taskId: string): Promise<void> {
  // Load the task with everything we need
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      mandateId: true,
      workspaceId: true,
      status: true,
      title: true,
      description: true,
      stepCount: true,
      tokenUsage: true,
      steps: {
        select: { id: true, stepType: true, status: true, output: true },
        orderBy: { stepNumber: "asc" },
      },
      approvals: {
        select: { id: true, decision: true, tool: true, reason: true },
      },
    },
  });

  if (!task || !task.mandateId) return;

  // Parse the strategy from the task description (stored by the supervisor)
  const strategyMatch = task.description?.match(/Strategy: (\w+)/);
  const strategy = strategyMatch?.[1] || null;

  // Gather evidence: reminders and payments linked to this workspace's invoices
  // that were created AFTER this task was created (proxy for "this episode produced them")
  const taskCreatedAt = await db.task.findUnique({ where: { id: taskId }, select: { createdAt: true } });
  const sevenDaysAfter = new Date((taskCreatedAt?.createdAt || new Date()).getTime() + 7 * 24 * 60 * 60 * 1000);

  const recentReminders = await db.reminder.findMany({
    where: {
      workspaceId: task.workspaceId,
      createdAt: { gte: taskCreatedAt?.createdAt, lte: sevenDaysAfter },
    },
    select: { id: true, status: true, sentAt: true, respondedAt: true, responseNotes: true, customerId: true },
    take: 20,
  });

  const recentPayments = await db.payment.findMany({
    where: {
      workspaceId: task.workspaceId,
      recordedAt: { gte: taskCreatedAt?.createdAt },
    },
    select: { id: true, amount: true, invoiceId: true },
    take: 10,
  });

  // Load the outcome evaluation if it exists
  const evaluation = await db.outcomeEvaluation.findUnique({
    where: { taskId },
    select: { qualityScore: true, actualSuccess: true, outcomeSummary: true, confidenceAccuracy: true },
  });

  const outcome: EpisodeOutcome = {
    taskId,
    mandateId: task.mandateId,
    workspaceId: task.workspaceId,
    status: task.status,
    strategy,
    stepCount: task.stepCount,
    completedStepCount: task.steps.filter((s) => s.status === "completed").length,
    failedStepCount: task.steps.filter((s) => s.status === "failed").length,
    approvalRejections: task.approvals.filter((a) => a.decision === "rejected").length,
    tokenUsage: task.tokenUsage || 0,
    outcomeSummary: evaluation?.outcomeSummary || null,
    remindersCreated: recentReminders.length,
    remindersSent: recentReminders.filter((r) => r.sentAt).length,
    customerResponses: recentReminders.filter((r) => r.respondedAt).length,
    paymentsReceived: recentPayments.length,
  };

  // ─── EVIDENCE → CANDIDATE → VALIDATION → MEMORY ──────────────────────────
  // Each candidate learning must pass validation before it is stored.

  const candidates = generateCandidates(outcome, task.title || "", recentReminders, recentPayments);

  for (const candidate of candidates) {
    if (candidate.isValid) {
      await appendMandateMemory(
        task.mandateId,
        candidate.memoryType,
        candidate.content,
        "task",
        taskId,
        candidate.confidence
      );
      console.log(`[Mandate Memory] Stored learning for mandate ${task.mandateId}: "${candidate.content.slice(0, 80)}..." (confidence: ${candidate.confidence})`);
    }
  }
}

interface CandidateLearning {
  memoryType: string;
  content: string;
  confidence: number;
  isValid: boolean;
}

/**
 * Generates candidate learnings from the episode outcome.
 *
 * Deterministic: same outcome → same candidates. Each candidate includes a
 * validation check — only candidates with sufficient evidence are stored.
 */
function generateCandidates(
  outcome: EpisodeOutcome,
  taskTitle: string,
  reminders: any[],
  payments: any[]
): CandidateLearning[] {
  const candidates: CandidateLearning[] = [];

  // ─── Candidate 1: Customer response pattern ─────────────────────────────
  // If reminders were sent AND customers responded, learn the response pattern.
  if (outcome.remindersSent > 0) {
    const responded = reminders.filter((r) => r.sentAt && r.respondedAt);
    const notResponded = reminders.filter((r) => r.sentAt && !r.respondedAt);

    if (responded.length > 0) {
      const responseRate = responded.length / outcome.remindersSent;
      // VALIDATION: at least 1 response, and the episode completed successfully
      const isValid = responseRate > 0 && outcome.status === "completed";
      candidates.push({
        memoryType: "customer_pattern",
        content: `${outcome.remindersSent} reminder(s) sent in episode "${taskTitle.slice(0, 60)}". ${responded.length} customer(s) responded (${(responseRate * 100).toFixed(0)}% response rate). Reminders are effective for these customers.`,
        confidence: Math.min(0.9, 0.4 + responseRate * 0.5),
        isValid,
      });
    } else if (notResponded.length > 0 && outcome.remindersSent >= 2) {
      // VALIDATION: at least 2 reminders sent with no response — strong signal
      candidates.push({
        memoryType: "customer_pattern",
        content: `${outcome.remindersSent} reminder(s) sent in episode "${taskTitle.slice(0, 60)}" with ZERO customer responses. These customers may require escalation rather than additional reminders.`,
        confidence: 0.7,
        isValid: true,
      });
    }
  }

  // ─── Candidate 2: Payment outcome ───────────────────────────────────────
  // If payments were received after the episode, learn that the strategy worked.
  if (outcome.paymentsReceived > 0 && outcome.status === "completed") {
    const totalPayment = payments.reduce((s, p) => s + (p.amount || 0), 0);
    candidates.push({
      memoryType: "outcome_lesson",
      content: `Episode "${taskTitle.slice(0, 60)}" resulted in ${outcome.paymentsReceived} payment(s) totaling ₹${totalPayment.toLocaleString("en-IN")}. The ${outcome.strategy || "selected"} strategy produced measurable financial recovery.`,
      confidence: 0.85,
      isValid: true,
    });
  }

  // ─── Candidate 3: Approval rejection pattern ────────────────────────────
  // If approvals were rejected, learn what the grantor disapproves of.
  if (outcome.approvalRejections > 0) {
    candidates.push({
      memoryType: "approval_feedback",
      content: `Episode "${taskTitle.slice(0, 60)}" had ${outcome.approvalRejections} approval(s) rejected by the grantor. The proposed action was outside the grantor's comfort zone. Future episodes should consider alternative approaches that don't require the rejected action.`,
      confidence: 0.8,
      isValid: true,
    });
  }

  // ─── Candidate 4: Strategy effectiveness ────────────────────────────────
  // If the episode used a specific strategy and completed, learn whether it worked.
  if (outcome.strategy && outcome.status === "completed") {
    const effectiveness = outcome.paymentsReceived > 0 ? "effective" : "executed without measurable recovery";
    candidates.push({
      memoryType: "strategy",
      content: `Strategy "${outcome.strategy}" was ${effectiveness}. Episode completed with ${outcome.completedStepCount}/${outcome.stepCount} steps. ${outcome.remindersSent} reminder(s) sent, ${outcome.customerResponses} response(s) received.`,
      confidence: outcome.paymentsReceived > 0 ? 0.8 : 0.5,
      isValid: true,
    });
  }

  // ─── Candidate 5: Failure lesson ────────────────────────────────────────
  if (outcome.status === "failed") {
    candidates.push({
      memoryType: "outcome_lesson",
      content: `Episode "${taskTitle.slice(0, 60)}" FAILED. ${outcome.failedStepCount} step(s) failed. The ${outcome.strategy || "selected"} strategy did not achieve the desired outcome. Future episodes should try a different approach.`,
      confidence: 0.75,
      isValid: true,
    });
  }

  return candidates;
}

/**
 * BIHARI AI — Autonomous Learning & Skill Evolution Engine (EMP-002)
 *
 * Transforms the Employee Profile from a static record into a continuously
 * learning workforce. Every completed task generates a deterministic Outcome
 * Evaluation, which drives:
 *
 *   1. Skill Reinforcement  — skills level up from real outcomes, not usage++
 *   2. Pattern Learning     — reusable patterns detected from repeated outcomes
 *   3. Weakness Detection   — repeated failures reduce trust
 *   4. Strength Detection   — repeated successes increase trust
 *   5. Business Outcome History — append-only ledger of measurable impact
 *   6. Career Timeline      — chronological log of every career event
 *   7. Achievement Unlocks  — milestone-based recognition
 *
 * Design principles (NON-NEGOTIABLE):
 *   - NO fake learning. NO random XP. NO LLM-generated scores.
 *   - Everything comes from MEASURABLE BUSINESS OUTCOMES.
 *   - Normalized tables — no JSON blobs for core entities.
 *   - Append-only history. Business outcomes never overwrite.
 *   - Incremental updates only — no expensive scans.
 *   - Generic — works for Finance, HR, Sales Ops, Procurement, etc.
 *
 * Architecture:
 *   The engine is called ONCE per task completion from the executor's
 *   `completeTask()` function. It runs AFTER `recordProfileEvent` so the
 *   profile counters are already updated. The engine then:
 *     1. Loads the task with steps + approvals + finance domain data
 *     2. Builds an OutcomeEvaluation (deterministic scorecard)
 *     3. Applies skill reinforcements based on the outcome
 *     4. Detects patterns (customer payment behavior, reminder effectiveness)
 *     5. Detects weaknesses (high rejection rate, low confidence, etc.)
 *     6. Detects strengths (high approval rate, fast execution, etc.)
 *     7. Records business outcomes (append-only ledger)
 *     8. Appends career timeline entries
 *     9. Checks for achievement unlocks
 *    10. Emits audit events for every evolution
 *
 * All of this happens in best-effort try/catch blocks — learning failures
 * must NEVER break task completion.
 */

import { db } from "@/lib/db";
import { appendAudit } from "@/lib/runtime/audit";
import {
  classifyFailure,
  type FailureContext,
} from "@/lib/learning/failure-taxonomy";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TaskOutcomeData {
  taskId: string;
  employeeId: string;
  workspaceId: string;
}

// ─── Skill Reinforcement Definitions ─────────────────────────────────────────
// Maps outcome events to skill reinforcements. GENERIC — no domain logic.
// The "skill" is inferred from the task's tools/keywords (same logic as the
// profile engine's inferAndUpdateSkills). The reinforcement is applied to
// EVERY skill that was exercised in the task.
//
// Reinforcement values are intentionally small so levels grow gradually:
//   +3 = major success (payment recovered, customer responded)
//   +2 = good outcome (approval approved, reminder sent)
//   +1 = minor success (task completed without issues)
//   -1 = minor issue (single rejection, single override)
//   -2 = moderate failure (rollback needed, multiple rejections)
//   -3 = major failure (task failed, capability denied repeatedly)

interface ReinforcementRule {
  reason: string;
  reinforcement: number;
  notes: string;
}

// ─── Skill Definitions (mirrored from profile engine for inference) ──────────
// These MUST stay in sync with src/lib/profile/engine.ts. We import the
// inference logic indirectly by re-querying the task's steps.

interface SkillDefinition {
  name: string;
  keywords: string[];
  tools: string[];
}

const FINANCE_SKILLS: SkillDefinition[] = [
  { name: "Invoice Analysis", keywords: ["invoice", "overdue", "outstanding", "aging"], tools: ["search_knowledge"] },
  { name: "Collections", keywords: ["collection", "reminder", "dunning", "follow-up"], tools: ["generate_reminder", "send_reminder", "update_collection_case"] },
  { name: "Credit Risk", keywords: ["risk", "credit", "exposure", "customer"], tools: [] },
  { name: "Reminder Strategy", keywords: ["reminder", "escalation", "follow-up"], tools: ["generate_reminder"] },
  { name: "GST Knowledge", keywords: ["gst", "tax", "gstin"], tools: [] },
  { name: "Negotiation", keywords: ["negotiation", "payment plan", "settlement"], tools: [] },
  { name: "Compliance", keywords: ["compliance", "policy", "regulation"], tools: [] },
  { name: "Policy Following", keywords: ["policy", "rule", "boundary"], tools: [] },
  { name: "Decision Making", keywords: ["recommendation", "decision", "action"], tools: [] },
];

const GENERIC_SKILLS: SkillDefinition[] = [
  { name: "Knowledge Retrieval", keywords: ["search", "knowledge", "research"], tools: ["search_knowledge"] },
  { name: "Communication", keywords: ["draft", "email", "response", "reply"], tools: ["draft_response", "send_email"] },
  { name: "Summarization", keywords: ["summarize", "summary", "brief"], tools: ["summarize"] },
];

function getSkillsForRole(role: string): SkillDefinition[] {
  if (role === "finance_employee") return [...FINANCE_SKILLS, ...GENERIC_SKILLS];
  return GENERIC_SKILLS;
}

// ─── 1. Outcome Evaluation ───────────────────────────────────────────────────

/**
 * Evaluates a completed task and produces a deterministic OutcomeEvaluation.
 *
 * This is the SINGLE entry point called from the executor after task
 * completion. It runs the full learning pipeline:
 *   evaluate → reinforce → patterns → weaknesses → strengths → outcomes → timeline → achievements
 *
 * All steps are best-effort. A failure in any step logs an error but does
 * not block the others.
 */
export async function evaluateAndLearn(data: TaskOutcomeData): Promise<void> {
  const { taskId, employeeId, workspaceId } = data;

  // Idempotency: skip if an evaluation already exists for this task
  const existing = await db.outcomeEvaluation.findUnique({ where: { taskId } });
  if (existing) {
    return;
  }

  // Load the task with everything we need
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      approvals: true,
      employee: true,
    },
  });

  if (!task) {
    console.error(`[Learning] Task not found: ${taskId}`);
    return;
  }

  // Only evaluate completed tasks (not failed/stopped)
  if (task.status !== "completed") {
    return;
  }

  const evaluation = await buildOutcomeEvaluation(task);
  if (!evaluation) return;

  // Run the learning pipeline (each step is independent & best-effort)
  try { await reinforceSkillsFromOutcome(task, evaluation); } catch (e) { console.error("[Learning] reinforceSkills failed:", e); }
  try { await detectPatternsFromOutcome(task, evaluation); } catch (e) { console.error("[Learning] detectPatterns failed:", e); }
  try { await detectWeaknesses(employeeId, workspaceId); } catch (e) { console.error("[Learning] detectWeaknesses failed:", e); }
  try { await detectStrengths(employeeId, workspaceId); } catch (e) { console.error("[Learning] detectStrengths failed:", e); }
  try { await recordBusinessOutcomesFromTask(task, evaluation); } catch (e) { console.error("[Learning] recordBusinessOutcomes failed:", e); }
  try { await appendTimelineFromOutcome(task, evaluation); } catch (e) { console.error("[Learning] appendTimeline failed:", e); }
  try { await checkAchievementUnlocks(employeeId, workspaceId, evaluation); } catch (e) { console.error("[Learning] checkAchievements failed:", e); }
}

// ─── 1b. Failure Evaluation (structured failure taxonomy) ────────────────────

export interface FailureTaskData {
  taskId: string;
  employeeId: string;
  workspaceId: string;
  /** The free-text failure reason (from the executor's failure path). */
  failureReason: string;
  /** Structured context about WHERE the failure occurred. */
  failureContext?: FailureContext;
}

/**
 * Evaluates a FAILED task and produces an OutcomeEvaluation with structured
 * failure classification.
 *
 * This is the failure counterpart to `evaluateAndLearn`. It:
 *   1. Classifies the failure using the deterministic taxonomy
 *      (src/lib/learning/failure-taxonomy.ts)
 *   2. Creates an OutcomeEvaluation with actualSuccess=false + the
 *      failureType/failureCategory/failureSeverity fields populated
 *   3. Runs the learning pipeline with NEGATIVE reinforcement — the
 *      employee learns from failures, not just successes
 *   4. Detects weaknesses from the structured failure data
 *
 * Called from every failure path in the executor (plan failure, step
 * failure, capability denial, approval rejection, timeout). Best-effort —
 * never blocks the failure itself.
 */
export async function evaluateAndLearnFailure(data: FailureTaskData): Promise<void> {
  const { taskId, employeeId, workspaceId, failureReason, failureContext } = data;

  // Idempotency: skip if an evaluation already exists for this task
  const existing = await db.outcomeEvaluation.findUnique({ where: { taskId } });
  if (existing) {
    return;
  }

  // Load the task with everything we need
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      approvals: true,
      employee: true,
    },
  });

  if (!task) {
    console.error(`[Learning] Failed task not found: ${taskId}`);
    return;
  }

  // Only evaluate failed tasks
  if (task.status !== "failed") {
    return;
  }

  // ─── Classify the failure ────────────────────────────────────────────────
  const classification = classifyFailure(failureReason, failureContext || {});

  // ─── Build the failure evaluation ────────────────────────────────────────
  const stepCount = task.steps.length;
  const toolCallCount = task.steps.filter((s: any) => s.stepType === "tool_call").length;
  const approvalGateCount = task.steps.filter((s: any) => s.stepType === "approval_gate").length;
  const approvals = task.approvals || [];
  const approvalRejections = approvals.filter((a: any) => a.decision === "rejected").length;
  const tokenUsage = task.tokenUsage || 0;

  const executionTimeMs =
    task.startedAt && task.completedAt
      ? new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()
      : 0;

  const stepFailureCount = task.steps.filter((s: any) => s.status === "failed").length;
  const humanCorrections = approvalRejections;

  // For failures: actualSuccess=false, expectedSuccess=true (employee expected
  // to succeed but didn't). confidenceAccuracy = 0.0 (prediction was wrong).
  const expectedSuccess = true;
  const actualSuccess = false;
  const confidenceAccuracy = 0.0;

  // Quality score for a failure: base 0, +10 if some steps succeeded,
  // +10 if no human corrections needed (the failure was technical, not policy)
  let qualityScore = 0;
  const completedSteps = task.steps.filter((s: any) => s.status === "completed").length;
  if (completedSteps > 0) qualityScore += 10;
  if (humanCorrections === 0) qualityScore += 10;
  // Penalize policy blocks and terminal failures
  if (classification.failureCategory === "terminal") qualityScore = Math.min(qualityScore, 5);
  if (classification.failureCategory === "policy_block") qualityScore = Math.min(qualityScore, 15);

  const outcomeSummary = `Task failed — ${classification.failureType.replace(/_/g, " ")} (${classification.failureCategory}, ${classification.failureSeverity} severity). ${completedSteps}/${stepCount} steps completed before failure. Reason: ${failureReason.slice(0, 120)}`;

  const evaluation = await db.outcomeEvaluation.create({
    data: {
      workspaceId,
      employeeId,
      taskId,
      stepCount,
      toolCallCount,
      approvalGateCount,
      approvalRejections,
      humanOverrides: 0,
      capabilityDenials: classification.failureType === "capability_denied" ? 1 : 0,
      tokenUsage,
      executionTimeMs,
      rollbackNeeded: false,
      paymentReceived: false,
      paymentAmount: 0,
      invoiceResolved: false,
      customerResponded: false,
      reminderSentCount: 0,
      slaAchieved: false,
      slaTargetHours: 24,
      slaActualHours: executionTimeMs / (1000 * 60 * 60),
      errorCount: 1,
      stepFailureCount,
      expectedSuccess,
      actualSuccess,
      confidenceAccuracy,
      qualityScore,
      humanCorrections,
      outcomeSummary,
      // ─── Failure Taxonomy ──────────────────────────────────────────────
      failureType: classification.failureType,
      failureCategory: classification.failureCategory,
      failureSeverity: classification.failureSeverity,
      failureReason,
    },
  });

  console.log(`[Learning] Failure evaluation recorded for task ${taskId}: ${classification.failureType} (${classification.failureCategory}/${classification.failureSeverity}), quality=${qualityScore}`);

  // ─── Run the learning pipeline with the failure evaluation ───────────────
  // The same pipeline as evaluateAndLearn, but the evaluation has
  // actualSuccess=false, so reinforcement rules will apply NEGATIVE
  // reinforcement (skills involved in the failure are weakened).
  try { await reinforceSkillsFromOutcome(task, evaluation); } catch (e) { console.error("[Learning] reinforceSkills (failure) failed:", e); }
  try { await detectPatternsFromOutcome(task, evaluation); } catch (e) { console.error("[Learning] detectPatterns (failure) failed:", e); }
  try { await detectWeaknesses(employeeId, workspaceId); } catch (e) { console.error("[Learning] detectWeaknesses (failure) failed:", e); }
  try { await recordBusinessOutcomesFromTask(task, evaluation); } catch (e) { console.error("[Learning] recordBusinessOutcomes (failure) failed:", e); }
  try { await appendTimelineFromOutcome(task, evaluation); } catch (e) { console.error("[Learning] appendTimeline (failure) failed:", e); }
}

/**
 * Builds the deterministic OutcomeEvaluation scorecard.
 * Pure function — no side effects except the DB write.
 */
async function buildOutcomeEvaluation(task: any): Promise<any | null> {
  const { id: taskId, workspaceId, employeeId } = task;

  // ─── Execution quality (from task + steps + approvals) ──────────────────
  const stepCount = task.steps.length;
  const toolCallCount = task.steps.filter((s: any) => s.stepType === "tool_call").length;
  const approvalGateCount = task.steps.filter((s: any) => s.stepType === "approval_gate").length;
  const approvals = task.approvals || [];
  const approvalRejections = approvals.filter((a: any) => a.decision === "rejected").length;
  const humanOverrides = approvals.filter((a: any) => a.originalAction !== null).length;
  const tokenUsage = task.tokenUsage || 0;

  // Execution time
  const executionTimeMs =
    task.startedAt && task.completedAt
      ? new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()
      : 0;

  // Capability denials + step failures (scan step outputs)
  let capabilityDenials = 0;
  let stepFailureCount = 0;
  for (const step of task.steps) {
    if (step.status === "failed") stepFailureCount++;
    if (step.output && step.output.includes("capability_denied")) {
      capabilityDenials++;
    }
  }

  // ─── Business outcome (from finance domain — generic approach) ──────────
  const { paymentReceived, paymentAmount, invoiceResolved, customerResponded, reminderSentCount, invoiceIds, customerIds } =
    await detectBusinessOutcomes(task, workspaceId);

  // ─── SLA ────────────────────────────────────────────────────────────────
  // SLA target: 24 hours for finance tasks (configurable per role in future)
  const slaTargetHours = 24;
  const slaActualHours = executionTimeMs / (1000 * 60 * 60);
  const slaAchieved = slaActualHours <= slaTargetHours && stepFailureCount === 0;

  // ─── Confidence accuracy ────────────────────────────────────────────────
  const completedSteps = task.steps.filter((s: any) => s.status === "completed" && s.confidence !== null);
  const avgConfidence =
    completedSteps.length > 0
      ? completedSteps.reduce((sum: number, s: any) => sum + (s.confidence || 0), 0) / completedSteps.length
      : 0.85;
  const expectedSuccess = avgConfidence >= 0.7;
  const actualSuccess = task.status === "completed" && approvalRejections === 0;
  const confidenceAccuracy = expectedSuccess === actualSuccess ? 1.0 : 0.0;

  // ─── Human corrections ──────────────────────────────────────────────────
  const humanCorrections = approvalRejections + humanOverrides + capabilityDenials;

  // ─── Quality score (deterministic formula, 0-100) ───────────────────────
  let qualityScore = 0;
  if (actualSuccess) qualityScore += 40;
  if (humanCorrections === 0) qualityScore += 20;
  else if (humanCorrections === 1) qualityScore += 10;
  if (slaAchieved) qualityScore += 15;
  if (confidenceAccuracy === 1.0) qualityScore += 15;
  if (paymentReceived || customerResponded) qualityScore += 10;

  // ─── Outcome summary (deterministic, built from facts) ──────────────────
  const outcomeParts: string[] = [];
  outcomeParts.push(`Task completed with ${stepCount} steps (${toolCallCount} tool calls, ${approvalGateCount} approval gates)`);
  if (approvalRejections > 0) outcomeParts.push(`${approvalRejections} approval rejection(s)`);
  if (humanOverrides > 0) outcomeParts.push(`${humanOverrides} human override(s)`);
  if (capabilityDenials > 0) outcomeParts.push(`${capabilityDenials} capability denial(s)`);
  if (reminderSentCount > 0) outcomeParts.push(`${reminderSentCount} reminder(s) sent`);
  if (paymentReceived) outcomeParts.push(`Payment received: ₹${(paymentAmount / 100).toFixed(2)}`);
  if (customerResponded) outcomeParts.push("Customer responded to reminder");
  if (slaAchieved) outcomeParts.push(`SLA achieved (${slaActualHours.toFixed(1)}h / ${slaTargetHours}h)`);
  else outcomeParts.push(`SLA missed (${slaActualHours.toFixed(1)}h / ${slaTargetHours}h)`);
  const outcomeSummary = outcomeParts.join(". ");

  // ─── Persist the evaluation ─────────────────────────────────────────────
  const evaluation = await db.outcomeEvaluation.create({
    data: {
      workspaceId,
      employeeId,
      taskId,
      stepCount,
      toolCallCount,
      approvalGateCount,
      approvalRejections,
      humanOverrides,
      capabilityDenials,
      tokenUsage,
      executionTimeMs,
      rollbackNeeded: false,
      paymentReceived,
      paymentAmount,
      invoiceResolved,
      customerResponded,
      reminderSentCount,
      slaAchieved,
      slaTargetHours,
      slaActualHours: Math.round(slaActualHours * 100) / 100,
      errorCount: stepFailureCount,
      stepFailureCount,
      expectedSuccess,
      actualSuccess,
      confidenceAccuracy,
      qualityScore,
      humanCorrections,
      outcomeSummary,
    },
  });

  // Audit: profile_updated (the outcome evaluation IS a profile update)
  await emitAudit(workspaceId, employeeId, "profile_updated", "outcome_evaluation", evaluation.id, {
    taskId,
    qualityScore: String(qualityScore),
    actualSuccess: String(actualSuccess),
    humanCorrections: String(humanCorrections),
    paymentReceived: String(paymentReceived),
    paymentAmount: String(paymentAmount),
  });

  // Attach the computed (non-persisted) fields for downstream functions.
  // These are not DB columns but are needed by recordBusinessOutcomesFromTask,
  // detectPatternsFromOutcome, etc.
  return {
    ...evaluation,
    invoiceIds,
    customerIds,
  };
}

/**
 * Detects business outcomes for a task by examining finance domain data.
 * GENERIC approach: scan the task's steps for invoice IDs and check if
 * payments were received or customers responded. Returns empty results for
 * non-finance tasks (which is correct — they have no finance outcomes).
 */
async function detectBusinessOutcomes(task: any, workspaceId: string): Promise<{
  paymentReceived: boolean;
  paymentAmount: number;
  invoiceResolved: boolean;
  customerResponded: boolean;
  reminderSentCount: number;
  invoiceIds: string[];
  customerIds: string[];
}> {
  const result = {
    paymentReceived: false,
    paymentAmount: 0,
    invoiceResolved: false,
    customerResponded: false,
    reminderSentCount: 0,
    invoiceIds: [] as string[],
    customerIds: [] as string[],
  };

  const invoiceIds = new Set<string>();
  const customerIds = new Set<string>();

  // Scan steps for invoiceId / customerId / reminderId in their input/output JSON
  for (const step of task.steps) {
    try {
      const input = JSON.parse(step.input || "{}");
      if (input.invoiceIds && Array.isArray(input.invoiceIds)) {
        input.invoiceIds.forEach((id: string) => invoiceIds.add(id));
      }
      if (input.invoiceId) invoiceIds.add(input.invoiceId);
      if (input.customerId) customerIds.add(input.customerId);
      if (input.tool === "send_reminder" || input.tool === "generate_reminder") {
        result.reminderSentCount++;
      }
    } catch {}

    try {
      const output = JSON.parse(step.output || "{}");
      if (output.invoiceId) invoiceIds.add(output.invoiceId);
      if (output.customerId) customerIds.add(output.customerId);
      if (output.reminderId) {
        // This step created a reminder — check if it was sent & responded
        const reminder = await db.reminder.findUnique({ where: { id: output.reminderId } });
        if (reminder) {
          if (reminder.status === "sent") result.reminderSentCount = Math.max(result.reminderSentCount, 1);
          if (reminder.status === "responded" || reminder.respondedAt) {
            result.customerResponded = true;
            customerIds.add(reminder.customerId);
          }
          invoiceIds.add(reminder.invoiceId);
          customerIds.add(reminder.customerId);
        }
      }
    } catch {}
  }

  result.invoiceIds = Array.from(invoiceIds);
  result.customerIds = Array.from(customerIds);

  // Check for payments received on these invoices AFTER the task started
  if (invoiceIds.size > 0) {
    const taskStartTime = task.startedAt || task.createdAt;
    const payments = await db.payment.findMany({
      where: {
        workspaceId,
        invoiceId: { in: result.invoiceIds },
        paymentDate: { gte: taskStartTime },
        status: "completed",
      },
    });

    if (payments.length > 0) {
      result.paymentReceived = true;
      result.paymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);

      const invoices = await db.invoice.findMany({
        where: { id: { in: result.invoiceIds } },
        select: { id: true, outstanding: true },
      });
      result.invoiceResolved = invoices.length > 0 && invoices.every((inv) => inv.outstanding <= 0);
    }
  }

  return result;
}

// ─── 2. Skill Reinforcement Engine ───────────────────────────────────────────

/**
 * Applies skill reinforcements based on the outcome evaluation.
 * Every skill exercised in the task gets reinforced (positively or negatively).
 */
async function reinforceSkillsFromOutcome(task: any, evaluation: any): Promise<void> {
  const { employeeId, workspaceId, taskId } = task;
  const employee = task.employee;
  if (!employee) return;

  // Determine which skills were exercised in this task
  const skillDefs = getSkillsForRole(employee.role);
  const taskText = `${task.title} ${task.description}`.toLowerCase();
  const toolsUsed = new Set<string>();
  for (const step of task.steps) {
    try {
      const input = JSON.parse(step.input);
      if (input.tool) toolsUsed.add(input.tool);
    } catch {}
  }

  const exercisedSkills: string[] = [];
  for (const skillDef of skillDefs) {
    const usedByKeyword = skillDef.keywords.some((kw) => taskText.includes(kw.toLowerCase()));
    const usedByTool = skillDef.tools.some((t) => toolsUsed.has(t));
    if (usedByKeyword || usedByTool) {
      exercisedSkills.push(skillDef.name);
    }
  }

  if (exercisedSkills.length === 0) return;

  // Build reinforcement rules based on the outcome
  const rules = buildReinforcementRules(evaluation);

  // Apply each rule to each exercised skill
  for (const skillName of exercisedSkills) {
    for (const rule of rules) {
      await db.skillReinforcement.create({
        data: {
          workspaceId,
          employeeId,
          skillName,
          taskId,
          outcomeId: evaluation.id,
          reason: rule.reason,
          reinforcement: rule.reinforcement,
          notes: rule.notes,
        },
      });
    }

    // Recompute the skill's level from the reinforcement ledger
    await recomputeSkillLevel(employeeId, workspaceId, skillName, evaluation);
  }
}

/**
 * Builds the list of reinforcement rules based on the outcome evaluation.
 */
function buildReinforcementRules(evaluation: any): ReinforcementRule[] {
  const rules: ReinforcementRule[] = [];

  if (evaluation.actualSuccess) {
    rules.push({ reason: "task_completed", reinforcement: 1, notes: "Task completed without failures" });
  }
  if (evaluation.paymentReceived) {
    rules.push({
      reason: "payment_recovered",
      reinforcement: 3,
      notes: `Payment of ₹${(evaluation.paymentAmount / 100).toFixed(2)} received after this task`,
    });
  }
  if (evaluation.customerResponded) {
    rules.push({ reason: "customer_responded", reinforcement: 2, notes: "Customer responded to a reminder sent in this task" });
  }
  if (evaluation.slaAchieved) {
    rules.push({ reason: "sla_achieved", reinforcement: 1, notes: `Completed within SLA (${evaluation.slaActualHours}h / ${evaluation.slaTargetHours}h)` });
  }
  if (evaluation.humanCorrections === 0 && evaluation.qualityScore >= 80) {
    rules.push({ reason: "high_quality_execution", reinforcement: 2, notes: `Quality score ${evaluation.qualityScore}/100 with zero human corrections` });
  }
  if (evaluation.approvalRejections > 0) {
    rules.push({
      reason: "approval_rejected",
      reinforcement: -1 * Math.min(3, evaluation.approvalRejections),
      notes: `${evaluation.approvalRejections} approval rejection(s)`,
    });
  }
  if (evaluation.humanOverrides > 0) {
    rules.push({
      reason: "human_override",
      reinforcement: -1 * Math.min(2, evaluation.humanOverrides),
      notes: `${evaluation.humanOverrides} human override(s)`,
    });
  }
  if (evaluation.capabilityDenials > 0) {
    rules.push({
      reason: "capability_denied",
      reinforcement: -2 * evaluation.capabilityDenials,
      notes: `${evaluation.capabilityDenials} capability denial(s)`,
    });
  }
  if (!evaluation.slaAchieved && evaluation.slaActualHours > 0) {
    rules.push({ reason: "sla_missed", reinforcement: -1, notes: `SLA missed (${evaluation.slaActualHours}h / ${evaluation.slaTargetHours}h)` });
  }
  if (evaluation.confidenceAccuracy === 0.0) {
    rules.push({ reason: "confidence_inaccurate", reinforcement: -1, notes: "Employee's confidence did not match the actual outcome" });
  }
  if (evaluation.stepFailureCount > 0) {
    rules.push({
      reason: "step_failure",
      reinforcement: -1 * Math.min(2, evaluation.stepFailureCount),
      notes: `${evaluation.stepFailureCount} step failure(s)`,
    });
  }

  return rules;
}

/**
 * Recomputes a skill's level from the reinforcement ledger.
 * Level formula:
 *   totalReinforcement = sum of all reinforcement values
 *   level = clamp(1, 10, 1 + floor(max(0, totalReinforcement) / 5))
 *   confidence = clamp(0.5, 0.99, 0.5 + (positive_count * 0.03) - (negative_count * 0.05))
 *
 * If the level increased, emit a skill_promoted audit event + timeline entry.
 */
async function recomputeSkillLevel(
  employeeId: string,
  workspaceId: string,
  skillName: string,
  evaluation: any
): Promise<void> {
  const reinforcements = await db.skillReinforcement.findMany({
    where: { employeeId, skillName },
    orderBy: { createdAt: "asc" },
  });

  if (reinforcements.length === 0) return;

  const totalReinforcement = reinforcements.reduce((sum, r) => sum + r.reinforcement, 0);
  const positiveCount = reinforcements.filter((r) => r.reinforcement > 0).length;
  const negativeCount = reinforcements.filter((r) => r.reinforcement < 0).length;

  const newLevel = Math.max(1, Math.min(10, 1 + Math.floor(Math.max(0, totalReinforcement) / 5)));
  const newConfidence = Math.max(0.5, Math.min(0.99, 0.5 + positiveCount * 0.03 - negativeCount * 0.05));
  const newUsageCount = reinforcements.length;

  const existing = await db.employeeSkill.findUnique({
    where: { employeeId_name: { employeeId, name: skillName } },
  });

  const previousLevel = existing?.level || 1;

  if (existing) {
    await db.employeeSkill.update({
      where: { id: existing.id },
      data: {
        level: newLevel,
        confidence: newConfidence,
        usageCount: newUsageCount,
        lastUsedAt: new Date(),
      },
    });
  } else {
    await db.employeeSkill.create({
      data: {
        employeeId,
        workspaceId,
        name: skillName,
        level: newLevel,
        confidence: newConfidence,
        usageCount: newUsageCount,
        lastUsedAt: new Date(),
      },
    });
  }

  // If level increased, emit skill_promoted audit + timeline
  if (newLevel > previousLevel) {
    await emitAudit(workspaceId, employeeId, "skill_promoted", "skill", skillName, {
      skillName,
      previousLevel: String(previousLevel),
      newLevel: String(newLevel),
      totalReinforcement: String(totalReinforcement),
    });

    await db.careerTimelineEntry.create({
      data: {
        workspaceId,
        employeeId,
        entryType: "skill_promoted",
        title: `${skillName} → Level ${newLevel}`,
        description: `Skill "${skillName}" promoted from Level ${previousLevel} to Level ${newLevel} based on ${reinforcements.length} reinforcements (net +${totalReinforcement}).`,
        metadata: JSON.stringify({ skillName, previousLevel, newLevel, totalReinforcement }),
        levelAtTime: 0,
        xpAtTime: 0,
        trustAtTime: 0,
        taskId: evaluation.taskId,
        outcomeId: evaluation.id,
      },
    });
  } else if (!existing && newLevel === 1) {
    // First time this skill was learned
    await db.careerTimelineEntry.create({
      data: {
        workspaceId,
        employeeId,
        entryType: "skill_learned",
        title: `Learned: ${skillName}`,
        description: `New skill "${skillName}" acquired with initial reinforcement +${totalReinforcement}.`,
        metadata: JSON.stringify({ skillName, initialReinforcement: totalReinforcement }),
        levelAtTime: 0,
        xpAtTime: 0,
        trustAtTime: 0,
        taskId: evaluation.taskId,
        outcomeId: evaluation.id,
      },
    });
  }

  // Sync the skills JSON on the profile (for quick access by the UI)
  await syncSkillsJson(employeeId);
}

/** Syncs the skills JSON array on EmployeeProfile from EmployeeSkill rows. */
async function syncSkillsJson(employeeId: string): Promise<void> {
  const allSkills = await db.employeeSkill.findMany({
    where: { employeeId },
    orderBy: { usageCount: "desc" },
  });
  const skillsJson = allSkills.map((s) => ({
    name: s.name,
    level: s.level,
    confidence: s.confidence,
    usageCount: s.usageCount,
  }));
  await db.employeeProfile.update({
    where: { employeeId },
    data: { skills: JSON.stringify(skillsJson) },
  });
}

// ─── 3. Pattern Learning ─────────────────────────────────────────────────────

/**
 * Detects reusable patterns from the outcome evaluation.
 * Patterns are STORED ONLY — not yet integrated with the Planner.
 */
async function detectPatternsFromOutcome(task: any, evaluation: any): Promise<void> {
  const { employeeId, workspaceId } = task;

  // ─── Pattern 1: Customer payment behavior ───────────────────────────────
  if (evaluation.paymentReceived && evaluation.invoiceIds.length > 0) {
    for (const invoiceId of evaluation.invoiceIds) {
      const invoice = await db.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true, reminders: { orderBy: { createdAt: "asc" } } },
      });
      if (!invoice) continue;

      const reminderCount = invoice.reminders.filter((r) => r.status === "sent").length;
      if (reminderCount === 0) continue;

      const patternKey = reminderCount === 1 ? "pays_after_first_reminder" : `pays_after_${reminderCount}_reminders`;
      const patternDescription = `${invoice.customer.name} paid invoice ${invoice.invoiceNumber} after ${reminderCount} reminder(s).`;

      await upsertPattern({
        workspaceId,
        employeeId,
        patternType: "customer_payment_behavior",
        entityType: "customer",
        entityId: invoice.customerId,
        entityLabel: invoice.customer.name,
        pattern: patternKey,
        description: patternDescription,
        confidence: Math.min(0.99, 0.5 + 0.1 * reminderCount),
      });
    }
  }

  // ─── Pattern 2: Reminder effectiveness ──────────────────────────────────
  if (evaluation.customerResponded && evaluation.customerIds.length > 0) {
    for (const customerId of evaluation.customerIds) {
      const customer = await db.customer.findUnique({ where: { id: customerId } });
      if (!customer) continue;

      await upsertPattern({
        workspaceId,
        employeeId,
        patternType: "reminder_effectiveness",
        entityType: "customer",
        entityId: customerId,
        entityLabel: customer.name,
        pattern: "responds_to_reminders",
        description: `${customer.name} responds to reminder emails.`,
        confidence: 0.7,
      });
    }
  }

  // ─── Pattern 3: Invoice risk indicator ──────────────────────────────────
  if (evaluation.approvalRejections > 0 && evaluation.invoiceIds.length > 0) {
    for (const invoiceId of evaluation.invoiceIds) {
      const invoice = await db.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: true },
      });
      if (!invoice) continue;

      // Invoices above ₹5 lakh (₹5,00,000 = 50,000,000 paise)
      if (invoice.total >= 50000000) {
        await upsertPattern({
          workspaceId,
          employeeId,
          patternType: "invoice_risk_indicator",
          entityType: "invoice",
          entityId: invoiceId,
          entityLabel: invoice.invoiceNumber,
          pattern: "high_value_invoice_needs_manager_review",
          description: `Invoice ${invoice.invoiceNumber} (₹${(invoice.total / 100).toFixed(2)}) required manager review.`,
          confidence: 0.6,
        });
      }
    }
  }
}

/**
 * Upserts a pattern: if it exists, increment observationCount and update confidence;
 * otherwise create it. Emits a pattern_learned audit on first detection.
 */
async function upsertPattern(params: {
  workspaceId: string;
  employeeId: string;
  patternType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  pattern: string;
  description: string;
  confidence: number;
}): Promise<void> {
  const existing = await db.learningPattern.findUnique({
    where: {
      employeeId_patternType_entityType_entityId_pattern: {
        employeeId: params.employeeId,
        patternType: params.patternType,
        entityType: params.entityType,
        entityId: params.entityId,
        pattern: params.pattern,
      },
    },
  });

  if (existing) {
    const newCount = existing.observationCount + 1;
    const newConfidence = Math.min(0.99, existing.confidence + 0.05);
    await db.learningPattern.update({
      where: { id: existing.id },
      data: {
        observationCount: newCount,
        confidence: newConfidence,
        lastObservedAt: new Date(),
        description: params.description,
      },
    });
  } else {
    const created = await db.learningPattern.create({
      data: {
        workspaceId: params.workspaceId,
        employeeId: params.employeeId,
        patternType: params.patternType,
        entityType: params.entityType,
        entityId: params.entityId,
        entityLabel: params.entityLabel,
        pattern: params.pattern,
        description: params.description,
        confidence: params.confidence,
        observationCount: 1,
      },
    });

    await emitAudit(params.workspaceId, params.employeeId, "pattern_learned", "learning_pattern", created.id, {
      patternType: params.patternType,
      pattern: params.pattern,
      entityLabel: params.entityLabel,
      description: params.description,
    });

    await db.careerTimelineEntry.create({
      data: {
        workspaceId: params.workspaceId,
        employeeId: params.employeeId,
        entryType: "pattern_learned",
        title: `Pattern: ${params.pattern.replace(/_/g, " ")}`,
        description: params.description,
        metadata: JSON.stringify({
          patternType: params.patternType,
          pattern: params.pattern,
          entityType: params.entityType,
          entityId: params.entityId,
        }),
        levelAtTime: 0,
        xpAtTime: 0,
        trustAtTime: 0,
      },
    });
  }
}

// ─── 4. Weakness Detection ───────────────────────────────────────────────────

/**
 * Detects weaknesses by scanning the last N outcome evaluations.
 * Called after every task completion (incremental).
 */
async function detectWeaknesses(employeeId: string, workspaceId: string): Promise<void> {
  const recentEvaluations = await db.outcomeEvaluation.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  if (recentEvaluations.length < 3) return;

  const totalTasks = recentEvaluations.length;
  const tasksWithRejections = recentEvaluations.filter((e) => e.approvalRejections > 0).length;
  const tasksWithOverrides = recentEvaluations.filter((e) => e.humanOverrides > 0).length;
  const tasksWithSlaMisses = recentEvaluations.filter((e) => !e.slaAchieved).length;
  const tasksWithDenials = recentEvaluations.filter((e) => e.capabilityDenials > 0).length;
  const avgConfidenceAccuracy = recentEvaluations.reduce((s, e) => s + e.confidenceAccuracy, 0) / totalTasks;
  const avgExecutionTime = recentEvaluations.reduce((s, e) => s + e.executionTimeMs, 0) / totalTasks;
  const avgSlaTarget = recentEvaluations[0]?.slaTargetHours || 24;

  const weaknessChecks = [
    {
      type: "high_rejection_rate",
      description: `${tasksWithRejections}/${totalTasks} recent tasks had approval rejections (${Math.round((tasksWithRejections / totalTasks) * 100)}%)`,
      metricValue: tasksWithRejections / totalTasks,
      threshold: 0.3,
      trustImpact: -5.0,
      inverted: false,
    },
    {
      type: "frequent_human_edits",
      description: `${tasksWithOverrides}/${totalTasks} recent tasks had human overrides (${Math.round((tasksWithOverrides / totalTasks) * 100)}%)`,
      metricValue: tasksWithOverrides / totalTasks,
      threshold: 0.4,
      trustImpact: -3.0,
      inverted: false,
    },
    {
      type: "repeated_sla_misses",
      description: `${tasksWithSlaMisses}/${totalTasks} recent tasks missed SLA (${Math.round((tasksWithSlaMisses / totalTasks) * 100)}%)`,
      metricValue: tasksWithSlaMisses / totalTasks,
      threshold: 0.3,
      trustImpact: -4.0,
      inverted: false,
    },
    {
      type: "low_confidence_accuracy",
      description: `Average confidence accuracy is ${(avgConfidenceAccuracy * 100).toFixed(0)}% (threshold 50%)`,
      metricValue: avgConfidenceAccuracy,
      threshold: 0.5,
      trustImpact: -3.0,
      inverted: true,
    },
    {
      type: "slow_execution",
      description: `Average execution time is ${(avgExecutionTime / (1000 * 60 * 60)).toFixed(1)}h (threshold ${avgSlaTarget * 2}h)`,
      metricValue: avgExecutionTime / (1000 * 60 * 60),
      threshold: avgSlaTarget * 2,
      trustImpact: -2.0,
      inverted: false, // higher execution time = worse
    },
  ];

  if (tasksWithDenials > 1) {
    weaknessChecks.push({
      type: "high_capability_denials",
      description: `${tasksWithDenials} capability denial(s) in recent ${totalTasks} tasks`,
      metricValue: tasksWithDenials,
      threshold: 1,
      trustImpact: -6.0,
      inverted: false, // higher denials = worse
    });
  }

  for (const check of weaknessChecks) {
    const triggered = check.inverted
      ? check.metricValue < check.threshold
      : check.metricValue > check.threshold;

    if (triggered) {
      await upsertWeakness({
        workspaceId,
        employeeId,
        weaknessType: check.type,
        description: check.description,
        metricValue: check.metricValue,
        threshold: check.threshold,
        trustImpact: check.trustImpact,
      });
    } else {
      await resolveWeaknessIfApplicable(workspaceId, employeeId, check.type);
    }
  }
}

async function upsertWeakness(params: {
  workspaceId: string;
  employeeId: string;
  weaknessType: string;
  description: string;
  metricValue: number;
  threshold: number;
  trustImpact: number;
}): Promise<void> {
  const existing = await db.employeeWeakness.findUnique({
    where: { employeeId_weaknessType: { employeeId: params.employeeId, weaknessType: params.weaknessType } },
  });

  if (existing) {
    if (existing.status === "resolved") {
      await db.employeeWeakness.update({
        where: { id: existing.id },
        data: {
          status: "active",
          description: params.description,
          metricValue: params.metricValue,
          occurrenceCount: { increment: 1 },
          lastDetectedAt: new Date(),
          resolvedAt: null,
        },
      });
    } else {
      await db.employeeWeakness.update({
        where: { id: existing.id },
        data: {
          description: params.description,
          metricValue: params.metricValue,
          occurrenceCount: { increment: 1 },
          lastDetectedAt: new Date(),
        },
      });
    }
  } else {
    const created = await db.employeeWeakness.create({
      data: {
        workspaceId: params.workspaceId,
        employeeId: params.employeeId,
        weaknessType: params.weaknessType,
        description: params.description,
        metricValue: params.metricValue,
        threshold: params.threshold,
        trustImpact: params.trustImpact,
        occurrenceCount: 1,
        status: "active",
      },
    });

    await emitAudit(params.workspaceId, params.employeeId, "weakness_detected", "employee_weakness", created.id, {
      weaknessType: params.weaknessType,
      description: params.description,
      trustImpact: String(params.trustImpact),
    });

    await db.careerTimelineEntry.create({
      data: {
        workspaceId: params.workspaceId,
        employeeId: params.employeeId,
        entryType: "weakness_detected",
        title: `Weakness: ${params.weaknessType.replace(/_/g, " ")}`,
        description: params.description,
        metadata: JSON.stringify({
          weaknessType: params.weaknessType,
          metricValue: params.metricValue,
          threshold: params.threshold,
          trustImpact: params.trustImpact,
        }),
        levelAtTime: 0,
        xpAtTime: 0,
        trustAtTime: 0,
      },
    });
  }
}

async function resolveWeaknessIfApplicable(
  workspaceId: string,
  employeeId: string,
  weaknessType: string
): Promise<void> {
  const existing = await db.employeeWeakness.findUnique({
    where: { employeeId_weaknessType: { employeeId, weaknessType } },
  });
  if (!existing || existing.status !== "active") return;

  await db.employeeWeakness.update({
    where: { id: existing.id },
    data: { status: "resolved", resolvedAt: new Date() },
  });

  await db.careerTimelineEntry.create({
    data: {
      workspaceId,
      employeeId,
      entryType: "weakness_resolved",
      title: `Resolved: ${weaknessType.replace(/_/g, " ")}`,
      description: `Weakness "${weaknessType}" has been resolved — recent metrics are now within acceptable thresholds.`,
      metadata: JSON.stringify({ weaknessType }),
      levelAtTime: 0,
      xpAtTime: 0,
      trustAtTime: 0,
    },
  });
}

// ─── 5. Strength Detection ───────────────────────────────────────────────────

/**
 * Detects strengths by scanning the last N outcome evaluations.
 * Called after every task completion (incremental).
 */
async function detectStrengths(employeeId: string, workspaceId: string): Promise<void> {
  const recentEvaluations = await db.outcomeEvaluation.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  if (recentEvaluations.length < 3) return;

  const totalTasks = recentEvaluations.length;
  const tasksWithRejections = recentEvaluations.filter((e) => e.approvalRejections > 0).length;
  const tasksWithSlaMisses = recentEvaluations.filter((e) => !e.slaAchieved).length;
  const tasksWithRollbacks = recentEvaluations.filter((e) => e.rollbackNeeded).length;
  const avgConfidenceAccuracy = recentEvaluations.reduce((s, e) => s + e.confidenceAccuracy, 0) / totalTasks;
  const avgQualityScore = recentEvaluations.reduce((s, e) => s + e.qualityScore, 0) / totalTasks;
  const avgExecutionTime = recentEvaluations.reduce((s, e) => s + e.executionTimeMs, 0) / totalTasks;
  const avgSlaTarget = recentEvaluations[0]?.slaTargetHours || 24;
  const paymentRecoveryCount = recentEvaluations.filter((e) => e.paymentReceived).length;

  const strengthChecks = [
    {
      type: "high_approval_rate",
      description: `100% approval rate across last ${totalTasks} tasks`,
      metricValue: (totalTasks - tasksWithRejections) / totalTasks,
      threshold: 1.0,
      trustImpact: 5.0,
    },
    {
      type: "consistent_sla",
      description: `100% SLA achievement across last ${totalTasks} tasks`,
      metricValue: (totalTasks - tasksWithSlaMisses) / totalTasks,
      threshold: 1.0,
      trustImpact: 4.0,
    },
    {
      type: "zero_rollbacks",
      description: `Zero rollbacks across last ${totalTasks} tasks`,
      metricValue: (totalTasks - tasksWithRollbacks) / totalTasks,
      threshold: 1.0,
      trustImpact: 3.0,
    },
    {
      type: "high_confidence_accuracy",
      description: `Average confidence accuracy is ${(avgConfidenceAccuracy * 100).toFixed(0)}%`,
      metricValue: avgConfidenceAccuracy,
      threshold: 0.8,
      trustImpact: 4.0,
    },
    {
      type: "high_quality",
      description: `Average quality score is ${avgQualityScore.toFixed(0)}/100`,
      metricValue: avgQualityScore / 100,
      threshold: 0.85,
      trustImpact: 4.0,
    },
    {
      type: "fast_execution",
      description: `Average execution time is ${(avgExecutionTime / (1000 * 60 * 60)).toFixed(1)}h (SLA target ${avgSlaTarget}h)`,
      metricValue: avgExecutionTime / (1000 * 60 * 60),
      threshold: avgSlaTarget * 0.5,
      trustImpact: 3.0,
    },
  ];

  if (paymentRecoveryCount >= 2) {
    strengthChecks.push({
      type: "excellent_collections",
      description: `Recovered payments in ${paymentRecoveryCount} of last ${totalTasks} tasks`,
      metricValue: paymentRecoveryCount / totalTasks,
      threshold: 0.4,
      trustImpact: 6.0,
    });
  }

  for (const check of strengthChecks) {
    if (check.metricValue >= check.threshold) {
      await upsertStrength({
        workspaceId,
        employeeId,
        strengthType: check.type,
        description: check.description,
        metricValue: check.metricValue,
        threshold: check.threshold,
        trustImpact: check.trustImpact,
      });
    }
  }
}

async function upsertStrength(params: {
  workspaceId: string;
  employeeId: string;
  strengthType: string;
  description: string;
  metricValue: number;
  threshold: number;
  trustImpact: number;
}): Promise<void> {
  const existing = await db.employeeStrength.findUnique({
    where: { employeeId_strengthType: { employeeId: params.employeeId, strengthType: params.strengthType } },
  });

  if (existing) {
    await db.employeeStrength.update({
      where: { id: existing.id },
      data: {
        description: params.description,
        metricValue: params.metricValue,
        occurrenceCount: { increment: 1 },
        lastDetectedAt: new Date(),
      },
    });
  } else {
    const created = await db.employeeStrength.create({
      data: {
        workspaceId: params.workspaceId,
        employeeId: params.employeeId,
        strengthType: params.strengthType,
        description: params.description,
        metricValue: params.metricValue,
        threshold: params.threshold,
        trustImpact: params.trustImpact,
        occurrenceCount: 1,
        status: "active",
      },
    });

    await emitAudit(params.workspaceId, params.employeeId, "strength_detected", "employee_strength", created.id, {
      strengthType: params.strengthType,
      description: params.description,
      trustImpact: String(params.trustImpact),
    });

    await db.careerTimelineEntry.create({
      data: {
        workspaceId: params.workspaceId,
        employeeId: params.employeeId,
        entryType: "strength_detected",
        title: `Strength: ${params.strengthType.replace(/_/g, " ")}`,
        description: params.description,
        metadata: JSON.stringify({
          strengthType: params.strengthType,
          metricValue: params.metricValue,
          threshold: params.threshold,
          trustImpact: params.trustImpact,
        }),
        levelAtTime: 0,
        xpAtTime: 0,
        trustAtTime: 0,
      },
    });
  }
}

// ─── 6. Business Outcome History (Append-Only) ───────────────────────────────

/**
 * Records business outcomes from a completed task. Append-only — never overwrites.
 * Also maintains running cumulative totals for historical charts.
 */
async function recordBusinessOutcomesFromTask(task: any, evaluation: any): Promise<void> {
  const { employeeId, workspaceId, taskId } = task;

  const profile = await db.employeeProfile.findUnique({ where: { employeeId } });
  if (!profile) return;

  const outcomes: Array<{
    outcomeType: string;
    amount: number;
    count: number;
    description: string;
  }> = [];

  outcomes.push({
    outcomeType: "task_automated",
    amount: 0,
    count: 1,
    description: `Task "${task.title}" completed automatically`,
  });

  outcomes.push({
    outcomeType: "hours_saved",
    amount: 0,
    count: 1,
    description: `0.5 hours of manual work saved`,
  });

  if (evaluation.reminderSentCount > 0) {
    outcomes.push({
      outcomeType: "email_sent",
      amount: 0,
      count: evaluation.reminderSentCount,
      description: `${evaluation.reminderSentCount} reminder email(s) sent`,
    });
  }

  if (evaluation.customerIds.length > 0) {
    outcomes.push({
      outcomeType: "customer_helped",
      amount: 0,
      count: evaluation.customerIds.length,
      description: `${evaluation.customerIds.length} customer(s) helped`,
    });
  }

  if (evaluation.invoiceIds.length > 0) {
    outcomes.push({
      outcomeType: "invoice_processed",
      amount: 0,
      count: evaluation.invoiceIds.length,
      description: `${evaluation.invoiceIds.length} invoice(s) processed`,
    });
  }

  if (evaluation.paymentReceived && evaluation.paymentAmount > 0) {
    outcomes.push({
      outcomeType: "money_recovered",
      amount: evaluation.paymentAmount,
      count: 1,
      description: `Payment of ₹${(evaluation.paymentAmount / 100).toFixed(2)} received`,
    });

    if (evaluation.paymentAmount > profile.moneyRecovered) {
      outcomes.push({
        outcomeType: "largest_recovery",
        amount: evaluation.paymentAmount,
        count: 1,
        description: `New largest single recovery: ₹${(evaluation.paymentAmount / 100).toFixed(2)}`,
      });
    }
  }

  if (evaluation.humanCorrections === 0 && evaluation.approvalGateCount === 0) {
    outcomes.push({
      outcomeType: "approval_avoided",
      amount: 0,
      count: 1,
      description: "Task completed without requiring any human approval",
    });
  }

  if (evaluation.capabilityDenials === 0 && !evaluation.rollbackNeeded) {
    outcomes.push({
      outcomeType: "escalation_avoided",
      amount: 0,
      count: 1,
      description: "Task completed without escalation",
    });
  }

  const newCumulative = {
    moneyRecovered: profile.moneyRecovered + (evaluation.paymentAmount || 0),
    invoicesProcessed: profile.invoicesProcessed + (evaluation.invoiceIds.length || 0),
    customersHelped: profile.customersHandled,
    hoursSaved: profile.hoursSaved,
    tasksAutomated: profile.tasksAutomated,
    emailsSent: profile.emailsSent,
  };

  for (const outcome of outcomes) {
    await db.businessOutcome.create({
      data: {
        workspaceId,
        employeeId,
        taskId,
        outcomeType: outcome.outcomeType,
        amount: outcome.amount,
        count: outcome.count,
        description: outcome.description,
        cumulativeMoneyRecovered: newCumulative.moneyRecovered,
        cumulativeInvoicesProcessed: newCumulative.invoicesProcessed,
        cumulativeCustomersHelped: newCumulative.customersHelped,
        cumulativeHoursSaved: newCumulative.hoursSaved,
        cumulativeTasksAutomated: newCumulative.tasksAutomated,
        cumulativeEmailsSent: newCumulative.emailsSent,
      },
    });
  }
}

// ─── 7. Career Timeline (from Outcome) ───────────────────────────────────────

/**
 * Appends career timeline entries from the outcome evaluation.
 * Separate from skill/strength/weakness/pattern timeline entries.
 */
async function appendTimelineFromOutcome(task: any, evaluation: any): Promise<void> {
  const { employeeId, workspaceId, taskId } = task;
  const profile = await db.employeeProfile.findUnique({ where: { employeeId } });
  if (!profile) return;

  await db.careerTimelineEntry.create({
    data: {
      workspaceId,
      employeeId,
      entryType: "task_completed",
      title: `Completed: ${task.title}`,
      description: evaluation.outcomeSummary,
      metadata: JSON.stringify({
        taskId,
        qualityScore: evaluation.qualityScore,
        humanCorrections: evaluation.humanCorrections,
        executionTimeMs: evaluation.executionTimeMs,
      }),
      levelAtTime: profile.level,
      xpAtTime: profile.experiencePoints,
      trustAtTime: profile.trustScore,
      taskId,
      outcomeId: evaluation.id,
    },
  });

  if (evaluation.paymentReceived && evaluation.paymentAmount >= 100000) {
    await db.careerTimelineEntry.create({
      data: {
        workspaceId,
        employeeId,
        entryType: "major_recovery",
        title: `Recovered ₹${(evaluation.paymentAmount / 100).toFixed(2)}`,
        description: `Recovered payment of ₹${(evaluation.paymentAmount / 100).toFixed(2)} through task "${task.title}".`,
        metadata: JSON.stringify({ taskId, amount: evaluation.paymentAmount }),
        levelAtTime: profile.level,
        xpAtTime: profile.experiencePoints,
        trustAtTime: profile.trustScore,
        taskId,
        outcomeId: evaluation.id,
      },
    });
  }
}

// ─── 8. Achievement Unlocks ──────────────────────────────────────────────────

/**
 * Checks for achievement unlocks based on the employee's current state.
 */
async function checkAchievementUnlocks(
  employeeId: string,
  workspaceId: string,
  evaluation: any
): Promise<void> {
  await seedDefaultAchievements(workspaceId);

  const profile = await db.employeeProfile.findUnique({ where: { employeeId } });
  if (!profile) return;

  const [achievements, unlocked] = await Promise.all([
    db.achievement.findMany({ where: { workspaceId } }),
    db.employeeAchievement.findMany({ where: { employeeId }, select: { achievementId: true } }),
  ]);
  const unlockedIds = new Set(unlocked.map((u) => u.achievementId));

  for (const achievement of achievements) {
    if (unlockedIds.has(achievement.id)) continue;

    let shouldUnlock = false;
    let evidence = "";

    switch (achievement.triggerType) {
      case "task_count":
        if (profile.completedTasks >= achievement.triggerThreshold) {
          shouldUnlock = true;
          evidence = `Completed ${profile.completedTasks} tasks (threshold: ${achievement.triggerThreshold})`;
        }
        break;
      case "money_recovered":
        if (profile.moneyRecovered >= achievement.triggerThreshold) {
          shouldUnlock = true;
          evidence = `Recovered ₹${(profile.moneyRecovered / 100).toFixed(2)} (threshold: ₹${(achievement.triggerThreshold / 100).toFixed(2)})`;
        }
        break;
      case "level_reached":
        if (profile.level >= achievement.triggerThreshold) {
          shouldUnlock = true;
          evidence = `Reached Level ${profile.level} (threshold: Level ${achievement.triggerThreshold})`;
        }
        break;
      case "skill_level":
        if (achievement.triggerSkillName) {
          const skill = await db.employeeSkill.findUnique({
            where: { employeeId_name: { employeeId, name: achievement.triggerSkillName } },
          });
          if (skill && skill.level >= achievement.triggerThreshold) {
            shouldUnlock = true;
            evidence = `Skill "${achievement.triggerSkillName}" reached Level ${skill.level} (threshold: Level ${achievement.triggerThreshold})`;
          }
        }
        break;
      case "perfect_quality": {
        const perfectCount = await db.outcomeEvaluation.count({
          where: { employeeId, qualityScore: 100 },
        });
        if (perfectCount >= achievement.triggerThreshold) {
          shouldUnlock = true;
          evidence = `${perfectCount} tasks with perfect quality score (threshold: ${achievement.triggerThreshold})`;
        }
        break;
      }
      case "streak": {
        const recentEvals = await db.outcomeEvaluation.findMany({
          where: { employeeId },
          orderBy: { createdAt: "desc" },
          take: achievement.triggerThreshold,
        });
        const allSuccess = recentEvals.length >= achievement.triggerThreshold &&
          recentEvals.every((e) => e.actualSuccess);
        if (allSuccess) {
          shouldUnlock = true;
          evidence = `${achievement.triggerThreshold} consecutive successful tasks`;
        }
        break;
      }
    }

    if (shouldUnlock) {
      await db.employeeAchievement.create({
        data: {
          workspaceId,
          employeeId,
          achievementId: achievement.id,
          evidence,
          taskId: evaluation.taskId,
          outcomeId: evaluation.id,
        },
      });

      await emitAudit(workspaceId, employeeId, "achievement_unlocked", "achievement", achievement.id, {
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        trustImpact: String(achievement.trustImpact),
        evidence,
      });

      await db.careerTimelineEntry.create({
        data: {
          workspaceId,
          employeeId,
          entryType: "achievement_unlocked",
          title: `Achievement: ${achievement.name}`,
          description: `${achievement.description} — ${evidence}`,
          metadata: JSON.stringify({
            code: achievement.code,
            name: achievement.name,
            trustImpact: achievement.trustImpact,
            evidence,
          }),
          levelAtTime: profile.level,
          xpAtTime: profile.experiencePoints,
          trustAtTime: profile.trustScore,
          taskId: evaluation.taskId,
          outcomeId: evaluation.id,
        },
      });
    }
  }
}

/**
 * Seeds the default achievement set for a workspace (idempotent).
 */
async function seedDefaultAchievements(workspaceId: string): Promise<void> {
  const existingCount = await db.achievement.count({ where: { workspaceId } });
  if (existingCount > 0) return;

  const defaults = [
    { code: "first_task", name: "First Task", description: "Completed the first task", category: "milestone", icon: "check-circle", triggerType: "task_count", triggerThreshold: 1, trustImpact: 2.0 },
    { code: "five_tasks", name: "Five Tasks", description: "Completed 5 tasks", category: "milestone", icon: "list-todo", triggerType: "task_count", triggerThreshold: 5, trustImpact: 3.0 },
    { code: "ten_tasks", name: "Ten Tasks", description: "Completed 10 tasks", category: "milestone", icon: "award", triggerType: "task_count", triggerThreshold: 10, trustImpact: 5.0 },
    { code: "first_recovery", name: "First Recovery", description: "Recovered the first payment", category: "performance", icon: "banknote", triggerType: "money_recovered", triggerThreshold: 1, trustImpact: 4.0 },
    { code: "major_recovery", name: "Major Recovery", description: "Recovered ₹10,000+ in a single task", category: "performance", icon: "banknote", triggerType: "money_recovered", triggerThreshold: 1000000, trustImpact: 6.0 },
    { code: "level_3", name: "Promoted to Employee", description: "Reached Level 3 (Employee)", category: "milestone", icon: "trending-up", triggerType: "level_reached", triggerThreshold: 3, trustImpact: 3.0 },
    { code: "level_5", name: "Promoted to Lead", description: "Reached Level 5 (Lead Employee)", category: "milestone", icon: "trophy", triggerType: "level_reached", triggerThreshold: 5, trustImpact: 5.0 },
    { code: "collections_expert", name: "Collections Expert", description: "Reached Level 5 in the Collections skill", category: "learning", icon: "graduation-cap", triggerType: "skill_level", triggerThreshold: 5, triggerSkillName: "Collections", trustImpact: 4.0 },
    { code: "perfect_quality", name: "Perfect Execution", description: "Completed a task with a perfect quality score (100/100)", category: "quality", icon: "sparkles", triggerType: "perfect_quality", triggerThreshold: 1, trustImpact: 5.0 },
    { code: "streak_3", name: "Three in a Row", description: "Completed 3 consecutive tasks without failures", category: "performance", icon: "flame", triggerType: "streak", triggerThreshold: 3, trustImpact: 3.0 },
    { code: "streak_5", name: "Five in a Row", description: "Completed 5 consecutive tasks without failures", category: "performance", icon: "flame", triggerType: "streak", triggerThreshold: 5, trustImpact: 5.0 },
  ];

  for (const def of defaults) {
    await db.achievement.upsert({
      where: { workspaceId_code: { workspaceId, code: def.code } },
      update: {},
      create: { workspaceId, ...def },
    });
  }
}

// ─── Audit Helper ────────────────────────────────────────────────────────────

async function emitAudit(
  workspaceId: string,
  _employeeId: string,
  entryType: string,
  targetType: string,
  targetId: string,
  payload: Record<string, string>
): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      await appendAudit(tx, {
        workspaceId,
        entryType,
        actorType: "system",
        actorId: null,
        actorName: "Learning Engine",
        targetType,
        targetId,
        payload,
      });
    });
  } catch (err) {
    console.error(`[Learning] Audit emission failed for ${entryType}:`, err);
  }
}

// ─── Retrieval Functions (for APIs) ──────────────────────────────────────────

export async function getCareerTimeline(employeeId: string, limit = 50) {
  return db.careerTimelineEntry.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getAchievements(employeeId: string) {
  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { workspaceId: true } });
  if (!employee) return [];
  const [definitions, unlocked] = await Promise.all([
    db.achievement.findMany({ where: { workspaceId: employee.workspaceId }, orderBy: { category: "asc" } }),
    db.employeeAchievement.findMany({
      where: { employeeId },
      include: { achievement: true },
      orderBy: { unlockedAt: "desc" },
    }),
  ]);

  const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u]));
  return definitions.map((def) => ({
    ...def,
    unlocked: unlockedMap.has(def.id),
    unlockedAt: unlockedMap.get(def.id)?.unlockedAt || null,
    evidence: unlockedMap.get(def.id)?.evidence || null,
  }));
}

export async function getPatterns(employeeId: string, limit = 50) {
  return db.learningPattern.findMany({
    where: { employeeId },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function getStrengths(employeeId: string) {
  return db.employeeStrength.findMany({
    where: { employeeId },
    orderBy: { trustImpact: "desc" },
  });
}

export async function getWeaknesses(employeeId: string) {
  return db.employeeWeakness.findMany({
    where: { employeeId },
    orderBy: { trustImpact: "asc" },
  });
}

export async function getOutcomeHistory(employeeId: string, limit = 20) {
  return db.outcomeEvaluation.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Aggregates failure analytics for an employee (or entire workspace).
 *
 * Returns structured counts by failure type, category, and severity —
 * the data needed for trust reports ("99.2% success, 0.8% recoverable
 * failures") and weakness detection.
 */
export async function getFailureAnalytics(
  employeeId?: string,
  workspaceId?: string
): Promise<{
  totalTasks: number;
  totalFailures: number;
  failureRate: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  recentFailures: Array<{
    taskId: string;
    failureType: string | null;
    failureCategory: string | null;
    failureSeverity: string | null;
    failureReason: string | null;
    qualityScore: number;
    createdAt: Date;
  }>;
}> {
  const where: { employeeId?: string; workspaceId?: string; actualSuccess?: boolean } = {};
  if (employeeId) where.employeeId = employeeId;
  if (workspaceId) where.workspaceId = workspaceId;

  const totalTasks = await db.outcomeEvaluation.count({ where });
  const failures = await db.outcomeEvaluation.findMany({
    where: { ...where, actualSuccess: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const f of failures) {
    const t = f.failureType || "unknown";
    const c = f.failureCategory || "unknown";
    const s = f.failureSeverity || "unknown";
    byType[t] = (byType[t] || 0) + 1;
    byCategory[c] = (byCategory[c] || 0) + 1;
    bySeverity[s] = (bySeverity[s] || 0) + 1;
  }

  return {
    totalTasks,
    totalFailures: failures.length,
    failureRate: totalTasks > 0 ? failures.length / totalTasks : 0,
    byType,
    byCategory,
    bySeverity,
    recentFailures: failures.slice(0, 10).map((f) => ({
      taskId: f.taskId,
      failureType: f.failureType,
      failureCategory: f.failureCategory,
      failureSeverity: f.failureSeverity,
      failureReason: f.failureReason,
      qualityScore: f.qualityScore,
      createdAt: f.createdAt,
    })),
  };
}

export async function getBusinessImpact(employeeId: string) {
  const outcomes = await db.businessOutcome.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const byType: Record<string, { count: number; totalAmount: number; lastAt: Date | null }> = {};
  for (const o of outcomes) {
    if (!byType[o.outcomeType]) {
      byType[o.outcomeType] = { count: 0, totalAmount: 0, lastAt: null };
    }
    byType[o.outcomeType].count += o.count;
    byType[o.outcomeType].totalAmount += o.amount;
    if (!byType[o.outcomeType].lastAt || o.createdAt > byType[o.outcomeType].lastAt!) {
      byType[o.outcomeType].lastAt = o.createdAt;
    }
  }

  const latest = outcomes[0];

  const allEvals = await db.outcomeEvaluation.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  let currentStreak = 0;
  for (const e of allEvals) {
    if (e.actualSuccess) currentStreak++;
    else break;
  }

  const largestRecovery = await db.businessOutcome.findFirst({
    where: { employeeId, outcomeType: "money_recovered" },
    orderBy: { amount: "desc" },
  });

  return {
    byType,
    cumulative: latest
      ? {
          moneyRecovered: latest.cumulativeMoneyRecovered,
          invoicesProcessed: latest.cumulativeInvoicesProcessed,
          customersHelped: latest.cumulativeCustomersHelped,
          hoursSaved: latest.cumulativeHoursSaved,
          tasksAutomated: latest.cumulativeTasksAutomated,
          emailsSent: latest.cumulativeEmailsSent,
        }
      : null,
    currentStreak,
    largestRecovery: largestRecovery
      ? { amount: largestRecovery.amount, taskId: largestRecovery.taskId, at: largestRecovery.createdAt }
      : null,
    totalOutcomes: outcomes.length,
  };
}

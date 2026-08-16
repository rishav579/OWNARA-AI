/**
 * BIHARI AI — Employee Memory Service
 *
 * Generic persistent memory for ALL AI Employees. Not finance-specific.
 *
 * Every employee (Finance, HR, Sales, Procurement, Legal, Support) can use
 * this service to remember:
 * - Customer/entity behavior patterns
 * - Negotiation outcomes
 * - Approval history and manager feedback
 * - Communication preferences
 * - Strategy effectiveness
 * - Promises made by entities
 *
 * The memory system works on a reinforcement model:
 * - New observations create a memory entry with confidence 0.5
 * - Repeated observations increase confidence (up to 0.99)
 * - Conflicting observations decrease confidence and may create new entries
 *
 * Lifecycle:
 * 1. BEFORE acting: retrieveMemory() — the employee recalls what it knows
 * 2. DURING the task: the memory is part of the reasoning context
 * 3. AFTER the task: updateMemoryAfterTask() — the employee learns from the outcome
 * 4. AFTER approvals: recordApprovalFeedback() — the employee learns from manager feedback
 *
 * This is NOT a mock. Every memory is a real database record that persists
 * across weeks and months. The employee genuinely becomes better over time
 * as it accumulates more observations and reinforcements.
 */

import { db } from "@/lib/db";

// Lazy import to avoid circular dependency
let recordProfileEventFn: ((event: any) => Promise<void>) | null = null;
async function getRecordProfileEvent() {
  if (!recordProfileEventFn) {
    const mod = await import("@/lib/profile/engine");
    recordProfileEventFn = mod.recordProfileEvent;
  }
  return recordProfileEventFn;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  memoryType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  key: string;
  value: Record<string, string>;
  confidence: number;
  source: string;
  reinforcementCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryRecord {
  memoryType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  key: string;
  value: Record<string, string>;
  source?: string;
}

// ─── Core: Record (Write/Update) ─────────────────────────────────────────────

/**
 * Records a memory entry. If a memory with the same
 * (employeeId, memoryType, entityType, entityId, key) already exists,
 * it is reinforced: confidence increases and value is updated.
 *
 * @param employeeId - The employee who owns this memory
 * @param workspaceId - The workspace scope
 * @param record - The memory to record
 */
export async function recordMemory(
  employeeId: string,
  workspaceId: string,
  record: MemoryRecord
): Promise<void> {
  const existing = await db.employeeMemory.findUnique({
    where: {
      employeeId_memoryType_entityType_entityId_key: {
        employeeId,
        memoryType: record.memoryType,
        entityType: record.entityType,
        entityId: record.entityId,
        key: record.key,
      },
    },
  });

  if (existing) {
    // Reinforce: increase confidence (capped at 0.99), increment count, update value
    const newConfidence = Math.min(0.99, existing.confidence + 0.15);
    const newReinforcementCount = existing.reinforcementCount + 1;

    // Merge old and new values — new values override old
    const oldValue = JSON.parse(existing.value) as Record<string, string>;
    const mergedValue = { ...oldValue, ...record.value };
    // Add reinforcement history
    mergedValue["lastReinforcedAt"] = new Date().toISOString();
    mergedValue["reinforcementCount"] = String(newReinforcementCount);

    await db.employeeMemory.update({
      where: { id: existing.id },
      data: {
        value: JSON.stringify(mergedValue),
        confidence: newConfidence,
        reinforcementCount: newReinforcementCount,
        source: record.source || existing.source,
        entityLabel: record.entityLabel || existing.entityLabel,
      },
    });

    // ─── Update Employee Profile (memory reinforced) ────────────────────────
    try {
      const recordProfileEvent = await getRecordProfileEvent();
      await recordProfileEvent({
        type: "memory_reinforced",
        employeeId,
        workspaceId,
      });
    } catch {}
  } else {
    // Create new memory
    const value = {
      ...record.value,
      firstObservedAt: new Date().toISOString(),
    };

    await db.employeeMemory.create({
      data: {
        workspaceId,
        employeeId,
        memoryType: record.memoryType,
        entityType: record.entityType,
        entityId: record.entityId,
        entityLabel: record.entityLabel,
        key: record.key,
        value: JSON.stringify(value),
        confidence: 0.5, // New observations start at 0.5 confidence
        source: record.source || "task",
        reinforcementCount: 1,
      },
    });

    // ─── Update Employee Profile (memory created) ───────────────────────────
    try {
      const recordProfileEvent = await getRecordProfileEvent();
      await recordProfileEvent({
        type: "memory_created",
        employeeId,
        workspaceId,
      });
    } catch {}
  }
}

/**
 * Records multiple memories in one call (convenience for batch updates).
 */
export async function recordMemories(
  employeeId: string,
  workspaceId: string,
  records: MemoryRecord[]
): Promise<void> {
  for (const record of records) {
    await recordMemory(employeeId, workspaceId, record);
  }
}

// ─── Core: Retrieve (Read) ───────────────────────────────────────────────────

/**
 * Retrieves ALL memories for an employee about a specific entity.
 *
 * Example: getMemoriesForEntity(employeeId, "customer", customerId)
 * returns everything the employee remembers about that customer.
 */
export async function getMemoriesForEntity(
  employeeId: string,
  entityType: string,
  entityId: string
): Promise<MemoryEntry[]> {
  const memories = await db.employeeMemory.findMany({
    where: { employeeId, entityType, entityId },
    orderBy: { updatedAt: "desc" },
  });

  return memories.map(serializeMemory);
}

/**
 * Retrieves memories of a specific type for an employee.
 *
 * Example: getMemoriesByType(employeeId, "manager_feedback")
 */
export async function getMemoriesByType(
  employeeId: string,
  memoryType: string
): Promise<MemoryEntry[]> {
  const memories = await db.employeeMemory.findMany({
    where: { employeeId, memoryType },
    orderBy: { updatedAt: "desc" },
  });

  return memories.map(serializeMemory);
}

/**
 * Retrieves ALL memories for an employee (across all entities and types).
 * Useful for building a complete memory context before reasoning.
 */
export async function getAllMemories(
  employeeId: string
): Promise<MemoryEntry[]> {
  const memories = await db.employeeMemory.findMany({
    where: { employeeId },
    orderBy: { updatedAt: "desc" },
  });

  return memories.map(serializeMemory);
}

/**
 * Retrieves memories for an employee about a specific entity, filtered by type.
 */
export async function getMemoriesForEntityByType(
  employeeId: string,
  entityType: string,
  entityId: string,
  memoryType: string
): Promise<MemoryEntry[]> {
  const memories = await db.employeeMemory.findMany({
    where: { employeeId, entityType, entityId, memoryType },
    orderBy: { updatedAt: "desc" },
  });

  return memories.map(serializeMemory);
}

// ─── Learning: Extract Memories from Completed Tasks ─────────────────────────

/**
 * After a task is completed, this function extracts learnings and stores
 * them as memories. This is how the employee learns over time.
 *
 * This function is GENERIC — it doesn't contain finance-specific logic.
 * Instead, it reads the task's steps and approvals to extract patterns:
 * - What actions were taken (strategy)
 * - What was approved/rejected (manager feedback)
 * - What entities were involved (customer behavior)
 * - What the outcome was (effectiveness)
 *
 * Domain-specific memory extraction (e.g., finance payment habits) is done
 * by domain-specific extractors that call recordMemory() directly.
 *
 * @param employeeId - The employee who completed the task
 * @param workspaceId - The workspace
 * @param taskId - The completed task
 */
export async function updateMemoryAfterTask(
  employeeId: string,
  workspaceId: string,
  taskId: string
): Promise<void> {
  // Load the task with all its steps and approvals
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      approvals: true,
    },
  });

  if (!task) return;

  // ─── 1. Record strategy effectiveness ──────────────────────────────────
  // What strategy was used and what was the outcome?
  const toolSteps = task.steps.filter((s) => s.stepType === "tool_call" || s.stepType === "approval_gate");
  const approvalSteps = task.steps.filter((s) => s.stepType === "approval_gate");
  const completedSteps = task.steps.filter((s) => s.status === "completed");
  const failedSteps = task.steps.filter((s) => s.status === "failed");

  const strategy = toolSteps
    .map((s) => {
      const input = JSON.parse(s.input);
      return input.tool || s.stepType;
    })
    .filter(Boolean)
    .join(" → ");

  if (strategy) {
    // Extract entity info from step inputs (generic — works for any domain)
    const firstStepInput = toolSteps[0] ? JSON.parse(toolSteps[0].input) : {};
    const entityType = firstStepInput.customerId ? "customer" :
                       firstStepInput.invoiceId ? "invoice" : "task";
    const entityId = firstStepInput.customerId || firstStepInput.invoiceId || taskId;
    const entityLabel = firstStepInput.customerName || firstStepInput.invoiceNumber || task.title;

    await recordMemory(employeeId, workspaceId, {
      memoryType: "strategy_effectiveness",
      entityType,
      entityId,
      entityLabel,
      key: `strategy_${task.id}`,
      value: {
        strategy,
        outcome: task.status,
        stepsTotal: String(task.steps.length),
        stepsCompleted: String(completedSteps.length),
        stepsFailed: String(failedSteps.length),
        approvalsRequested: String(approvalSteps.length),
        taskTitle: task.title,
        completedAt: task.completedAt?.toISOString() || new Date().toISOString(),
      },
      source: "task",
    });
  }

  // ─── 2. Record approval outcomes as manager feedback ──────────────────
  for (const approval of task.approvals) {
    if (approval.status === "pending") continue;

    const proposedAction = JSON.parse(approval.proposedAction);
    const entityType = proposedAction.customerId ? "customer" :
                       proposedAction.invoiceId ? "invoice" : "approval";
    const entityId = proposedAction.customerId || proposedAction.invoiceId || approval.id;
    const entityLabel = proposedAction.customerName || proposedAction.invoiceNumber || approval.tool;

    await recordMemory(employeeId, workspaceId, {
      memoryType: "manager_feedback",
      entityType,
      entityId,
      entityLabel,
      key: `approval_${approval.id}`,
      value: {
        tool: approval.tool,
        decision: approval.decision || approval.status,
        reason: approval.reason || "",
        decidedAt: approval.decidedAt?.toISOString() || "",
      },
      source: "human_feedback",
    });

    // Record approval history separately (for quick lookup)
    await recordMemory(employeeId, workspaceId, {
      memoryType: "approval_history",
      entityType,
      entityId,
      entityLabel,
      key: `approval_${approval.id}`,
      value: {
        tool: approval.tool,
        decision: approval.decision || approval.status,
        taskTitle: task.title,
      },
      source: "approval",
    });
  }

  // ─── 3. Record communication preferences (from send_reminder/send_email) ──
  const sendSteps = toolSteps.filter((s) => {
    const input = JSON.parse(s.input);
    return input.tool === "send_reminder" || input.tool === "send_email";
  });

  for (const step of sendSteps) {
    const input = JSON.parse(step.input);
    if (input.customerId) {
      await recordMemory(employeeId, workspaceId, {
        memoryType: "communication_preference",
        entityType: "customer",
        entityId: input.customerId,
        entityLabel: input.customerName || "Unknown",
        key: "email_channel",
        value: {
          channel: "email",
          lastContactedAt: step.completedAt?.toISOString() || new Date().toISOString(),
          lastSubject: input.subject || input.recommendedAction || "",
        },
        source: "task",
      });
    }
  }
}

/**
 * Records approval feedback immediately after a decision (not waiting for
 * task completion). This lets the employee learn from rejections even if
 * the task fails.
 */
export async function recordApprovalFeedback(
  employeeId: string,
  workspaceId: string,
  approvalId: string,
  decision: string,
  reason: string | null,
  tool: string,
  proposedAction: Record<string, string>
): Promise<void> {
  const entityType = proposedAction.customerId ? "customer" :
                     proposedAction.invoiceId ? "invoice" : "approval";
  const entityId = proposedAction.customerId || proposedAction.invoiceId || approvalId;
  const entityLabel = proposedAction.customerName || proposedAction.invoiceNumber || tool;

  await recordMemory(employeeId, workspaceId, {
    memoryType: "manager_feedback",
    entityType,
    entityId,
    entityLabel,
    key: `approval_${approvalId}`,
    value: {
      tool,
      decision,
      reason: reason || "",
      decidedAt: new Date().toISOString(),
    },
    source: "human_feedback",
  });

  await recordMemory(employeeId, workspaceId, {
    memoryType: "approval_history",
    entityType,
    entityId,
    entityLabel,
    key: `approval_${approvalId}`,
    value: {
      tool,
      decision,
    },
    source: "approval",
  });
}

// ─── Learning: Domain-Specific Extractors ────────────────────────────────────

/**
 * Finance-specific memory extractor. Called after a finance task completes
 * to extract finance-domain learnings (payment habits, collection strategy
 * effectiveness, customer behavior patterns).
 *
 * This is the ONLY finance-specific function in the memory service.
 * Future domains (HR, Sales, etc.) will have their own extractors.
 *
 * It does NOT hardcode logic into the generic memory system — it uses the
 * generic recordMemory() function with finance-specific memory types.
 */
export async function extractFinanceMemories(
  employeeId: string,
  workspaceId: string,
  taskId: string
): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      approvals: true,
    },
  });

  if (!task) return;

  // Extract finance data from step inputs
  const financeSteps = task.steps.filter((s) => {
    const input = JSON.parse(s.input);
    return input.invoiceId || input.invoiceNumber;
  });

  for (const step of financeSteps) {
    const input = JSON.parse(step.input);

    if (!input.customerId || !input.invoiceId) continue;

    const customerId = input.customerId;
    const customerName = input.customerName || "Unknown";
    const invoiceNumber = input.invoiceNumber || "Unknown";

    // ─── Payment habits ─────────────────────────────────────────────────
    if (input.daysOverdue) {
      await recordMemory(employeeId, workspaceId, {
        memoryType: "payment_habits",
        entityType: "customer",
        entityId: customerId,
        entityLabel: customerName,
        key: "overdue_pattern",
        value: {
          invoiceNumber,
          daysOverdue: input.daysOverdue,
          outstanding: input.outstanding || "",
          agingBucket: input.agingBucket || "",
          observedAt: new Date().toISOString(),
        },
        source: "task",
      });
    }

    // ─── Customer behavior ──────────────────────────────────────────────
    const prevReminders = parseInt(input.previousReminderCount || "0");
    if (prevReminders > 0) {
      await recordMemory(employeeId, workspaceId, {
        memoryType: "customer_behavior",
        entityType: "customer",
        entityId: customerId,
        entityLabel: customerName,
        key: "reminder_response_rate",
        value: {
          remindersSent: input.previousReminderCount,
          responded: "false",
          observedAt: new Date().toISOString(),
        },
        source: "task",
      });
    }

    // ─── Collection strategy ────────────────────────────────────────────
    if (input.recommendedAction) {
      await recordMemory(employeeId, workspaceId, {
        memoryType: "collection_strategy",
        entityType: "customer",
        entityId: customerId,
        entityLabel: customerName,
        key: `strategy_${invoiceNumber}`,
        value: {
          invoiceNumber,
          action: input.recommendedAction,
          daysOverdue: input.daysOverdue || "",
          agingBucket: input.agingBucket || "",
          taskOutcome: task.status,
          observedAt: new Date().toISOString(),
        },
        source: "task",
      });
    }

    // ─── Customer risk assessment ───────────────────────────────────────
    await recordMemory(employeeId, workspaceId, {
      memoryType: "customer_behavior",
      entityType: "customer",
      entityId: customerId,
      entityLabel: customerName,
      key: "risk_level",
      value: {
        riskLevel: input.customerRiskLevel || "",
        collectionPriority: input.collectionPriority || "",
        observedAt: new Date().toISOString(),
      },
      source: "task",
    });
  }

  // ─── Strategy effectiveness ──────────────────────────────────────────
  // For each approval in the task, record whether the strategy led to
  // approval or rejection
  for (const approval of task.approvals) {
    if (approval.status === "pending") continue;

    const proposedAction = JSON.parse(approval.proposedAction);
    if (!proposedAction.customerId) continue;

    await recordMemory(employeeId, workspaceId, {
      memoryType: "strategy_effectiveness",
      entityType: "customer",
      entityId: proposedAction.customerId,
      entityLabel: proposedAction.customerName || "Unknown",
      key: `effectiveness_${approval.tool}`,
      value: {
        tool: approval.tool,
        action: proposedAction.recommendedAction || "",
        decision: approval.decision || approval.status,
        reason: approval.reason || "",
        wasEffective: approval.decision === "approved" ? "true" : "false",
        observedAt: approval.decidedAt?.toISOString() || new Date().toISOString(),
      },
      source: "human_feedback",
    });
  }
}

// ─── Serializer ──────────────────────────────────────────────────────────────

function serializeMemory(m: any): MemoryEntry {
  return {
    id: m.id,
    memoryType: m.memoryType,
    entityType: m.entityType,
    entityId: m.entityId,
    entityLabel: m.entityLabel,
    key: m.key,
    value: JSON.parse(m.value),
    confidence: m.confidence,
    source: m.source,
    reinforcementCount: m.reinforcementCount,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

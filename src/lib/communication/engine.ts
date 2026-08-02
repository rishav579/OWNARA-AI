/**
 * BIHARI AI — AI Employee Communication Engine (COMM-001)
 *
 * The universal messaging layer for every AI Employee in BIHARI AI.
 * Allows AI Employees to communicate with humans, other AI Employees,
 * and future external systems using structured business communication.
 *
 * This is NOT a chat system. It is structured, explainable, auditable
 * business communication.
 *
 * Design principles (NON-NEGOTIABLE):
 *   1. Humans never receive raw AI reasoning — the engine transforms
 *      internal reasoning into professional business language.
 *   2. Every communication is explainable (why, evidence, confidence, impact).
 *   3. Threaded conversations with replies, acknowledgements, resolution.
 *   4. Deterministic scoring to avoid spam, merge similar alerts, throttle.
 *   5. Every communication becomes permanent memory (Learning Engine).
 *   6. Every communication generates audit events (Audit Chain).
 *   7. Generic and domain-independent — works for every employee type.
 *
 * Architecture:
 *   The engine composes with — does NOT duplicate — the existing systems:
 *   - Audit Chain: every communication generates audit events
 *   - Memory Engine: communication outcomes become permanent memory
 *   - Profile Engine: communication events update the employee profile
 *   - Learning Engine: communication effectiveness is scored over time
 *   - Capability Engine: not gated (communication is a universal right)
 *   - Approval Engine: approval_request type creates a linked Approval
 *
 * The engine is called from:
 *   - The Executor (when an employee needs to communicate during a task)
 *   - The Approval API (when a human responds to a communication)
 *   - Employee-to-employee coordination (when employees hand off work)
 *   - Future external system adapters
 */

import { db } from "@/lib/db";
import { appendAudit } from "@/lib/runtime/audit";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CommunicationType =
  | "notification"
  | "recommendation"
  | "escalation"
  | "clarification_request"
  | "information_request"
  | "approval_request"
  | "coordination_message"
  | "status_update"
  | "completion_report"
  | "warning"
  | "critical_alert";

export type Priority = "low" | "medium" | "high" | "critical";

export type ReceiverType = "human" | "employee" | "system" | "all_humans" | "all_employees";

export type CommunicationStatus =
  | "sent"
  | "delivered"
  | "read"
  | "acknowledged"
  | "resolved"
  | "ignored"
  | "escalated";

export interface CommunicationInput {
  workspaceId: string;
  senderEmployeeId?: string;
  senderUserId?: string;
  senderName: string;
  senderType: "employee" | "user" | "system";

  receiverType: ReceiverType;
  receiverEmployeeId?: string;
  receiverUserId?: string;
  receiverName: string;

  communicationType: CommunicationType;
  priority?: Priority;

  subject: string;
  summary: string;
  explanation: string;

  // Business context
  relatedTaskId?: string;
  relatedContractId?: string;
  relatedCustomerId?: string;
  relatedInvoiceId?: string;
  relatedApprovalId?: string;
  relatedReminderId?: string;

  // Explainability
  whyExists: string;
  evidence?: Array<{ source: string; fact: string; weight: string }>;
  confidence?: number;
  businessImpact: string;
  recommendedAction: string;
  expectedOutcome: string;

  // Attachments + actions
  attachments?: Array<{ type: string; label: string; ref: string }>;
  actionButtons?: Array<{ label: string; action: string; style: string }>;

  // Threading
  threadId?: string;
  parentCommunicationId?: string;
}

// ─── Throttling + Deduplication Config ───────────────────────────────────────

// Throttle window: if the same sender sends the same communicationType +
// subject to the same receiver within this window (ms), it's throttled.
const THROTTLE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Dedup window: if a message with the same (sender, receiver, communicationType,
// subject) exists within this window and is NOT resolved, the new one is a duplicate.
const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// ─── 1. Create Communication ─────────────────────────────────────────────────

/**
 * Creates a structured business communication.
 *
 * This is the SINGLE entry point for all AI Employee communication.
 * The function:
 *   1. Transforms the input into professional business language (already done by caller)
 *   2. Checks for duplicates (same sender + receiver + type + subject in the dedup window)
 *   3. Checks for throttling (same sender + receiver + type + subject in the throttle window)
 *   4. Computes a deterministic quality score (0-100)
 *   5. Creates or appends to a thread
 *   6. Writes the communication record
 *   7. Emits an audit event
 *   8. Records a memory (so the employee remembers sending it)
 *
 * Returns the created communication, or the original if this is a duplicate.
 */
export async function createCommunication(input: CommunicationInput): Promise<{
  id: string;
  isDuplicate: boolean;
  duplicateOfId?: string;
  isThrottled: boolean;
  qualityScore: number;
}> {
  const priority = input.priority || "medium";
  const confidence = input.confidence ?? 0.85;

  // ─── Step 1: Check for duplicates ────────────────────────────────────────
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MS);
  const existing = await db.employeeCommunication.findFirst({
    where: {
      workspaceId: input.workspaceId,
      senderEmployeeId: input.senderEmployeeId || null,
      senderUserId: input.senderUserId || null,
      receiverType: input.receiverType,
      receiverEmployeeId: input.receiverEmployeeId || null,
      receiverUserId: input.receiverUserId || null,
      communicationType: input.communicationType,
      subject: input.subject,
      status: { notIn: ["resolved", "ignored"] },
      createdAt: { gte: dedupSince },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    // This is a duplicate — don't create a new message, just return the original
    return {
      id: existing.id,
      isDuplicate: true,
      duplicateOfId: existing.id,
      isThrottled: false,
      qualityScore: existing.qualityScore,
    };
  }

  // ─── Step 2: Check for throttling ────────────────────────────────────────
  const throttleSince = new Date(Date.now() - THROTTLE_WINDOW_MS);
  const throttled = await db.employeeCommunication.findFirst({
    where: {
      workspaceId: input.workspaceId,
      senderEmployeeId: input.senderEmployeeId || null,
      senderUserId: input.senderUserId || null,
      receiverType: input.receiverType,
      receiverEmployeeId: input.receiverEmployeeId || null,
      receiverUserId: input.receiverUserId || null,
      communicationType: input.communicationType,
      subject: input.subject,
      createdAt: { gte: throttleSince },
    },
  });

  const isThrottled = !!throttled;

  // ─── Step 3: Compute deterministic quality score (0-100) ─────────────────
  const qualityScore = computeQualityScore(input, confidence);

  // ─── Step 4: Create or append to thread ──────────────────────────────────
  let threadId = input.threadId;
  if (!threadId && !input.parentCommunicationId) {
    // Start a new thread for top-level messages
    const thread = await db.communicationThread.create({
      data: {
        workspaceId: input.workspaceId,
        subject: input.subject,
        startedByEmployeeId: input.senderEmployeeId || null,
        startedByUserId: input.senderUserId || null,
        relatedTaskId: input.relatedTaskId || null,
        relatedCustomerId: input.relatedCustomerId || null,
        relatedInvoiceId: input.relatedInvoiceId || null,
        status: "active",
        priority,
        communicationType: input.communicationType,
        messageCount: 1,
        participantCount: 1,
        lastMessageAt: new Date(),
      },
    });
    threadId = thread.id;
  } else if (threadId) {
    // Append to existing thread — update counts + lastMessageAt
    await db.communicationThread.update({
      where: { id: threadId },
      data: {
        messageCount: { increment: 1 },
        lastMessageAt: new Date(),
        // Escalate thread priority if this message is higher
        priority: escalatePriority(priority, (await db.communicationThread.findUnique({ where: { id: threadId } }))?.priority || "medium"),
      },
    });
  }

  // ─── Step 5: Create the communication record ─────────────────────────────
  const communication = await db.employeeCommunication.create({
    data: {
      workspaceId: input.workspaceId,
      threadId: threadId || null,
      senderEmployeeId: input.senderEmployeeId || null,
      senderUserId: input.senderUserId || null,
      senderName: input.senderName,
      senderType: input.senderType,
      receiverType: input.receiverType,
      receiverEmployeeId: input.receiverEmployeeId || null,
      receiverUserId: input.receiverUserId || null,
      receiverName: input.receiverName,
      communicationType: input.communicationType,
      priority,
      subject: input.subject,
      summary: input.summary,
      explanation: input.explanation,
      relatedTaskId: input.relatedTaskId || null,
      relatedContractId: input.relatedContractId || null,
      relatedCustomerId: input.relatedCustomerId || null,
      relatedInvoiceId: input.relatedInvoiceId || null,
      relatedApprovalId: input.relatedApprovalId || null,
      relatedReminderId: input.relatedReminderId || null,
      whyExists: input.whyExists,
      evidence: JSON.stringify(input.evidence || []),
      confidence,
      businessImpact: input.businessImpact,
      recommendedAction: input.recommendedAction,
      expectedOutcome: input.expectedOutcome,
      attachments: JSON.stringify(input.attachments || []),
      actionButtons: JSON.stringify(input.actionButtons || []),
      status: isThrottled ? "sent" : "sent", // throttled messages are still sent but flagged
      qualityScore,
      isDuplicate: false,
      isThrottled,
    },
  });

  // ─── Step 6: Emit audit event ────────────────────────────────────────────
  try {
    await db.$transaction(async (tx) => {
      await appendAudit(tx, {
        workspaceId: input.workspaceId,
        entryType: "communication_created",
        actorType: input.senderType as "user" | "employee" | "system",
        actorId: input.senderEmployeeId || input.senderUserId || null,
        actorName: input.senderName,
        targetType: "communication",
        targetId: communication.id,
        payload: {
          communicationType: input.communicationType,
          priority,
          subject: input.subject,
          receiverType: input.receiverType,
          receiverName: input.receiverName,
          threadId: threadId || "",
          qualityScore: String(qualityScore),
          isThrottled: String(isThrottled),
        },
      });
    });
  } catch (err) {
    console.error("[Communication] Audit emission failed:", err);
  }

  // ─── Step 7: Record memory (so the employee remembers sending it) ────────
  if (input.senderEmployeeId) {
    try {
      const { recordMemory } = await import("@/lib/memory/service");
      await recordMemory(input.senderEmployeeId, input.workspaceId, {
        memoryType: "communication_preference",
        entityType: "communication",
        entityId: communication.id,
        entityLabel: input.subject,
        key: `${input.communicationType}_${input.receiverType}`,
        value: {
          subject: input.subject,
          communicationType: input.communicationType,
          priority,
          receiverType: input.receiverType,
          receiverName: input.receiverName,
          qualityScore: String(qualityScore),
          sentAt: new Date().toISOString(),
        },
        source: "communication_engine",
      });
    } catch (err) {
      console.error("[Communication] Memory recording failed:", err);
    }
  }

  return {
    id: communication.id,
    isDuplicate: false,
    isThrottled,
    qualityScore,
  };
}

// ─── 2. Quality Score Computation (Deterministic) ────────────────────────────

/**
 * Computes a deterministic quality score (0-100) for a communication.
 *
 * Components (each contributes to a 0-100 score):
 *   30% — Has all explainability fields (whyExists, evidence, businessImpact, recommendedAction, expectedOutcome)
 *   20% — Confidence (higher = better)
 *   15% — Priority alignment (critical/warning types should have high priority)
 *   15% — Has business context (related entities)
 *   10% — Has action buttons (actionable)
 *   10% — Subject + summary quality (length check)
 */
function computeQualityScore(input: CommunicationInput, confidence: number): number {
  let score = 0;

  // Explainability completeness (30%)
  if (input.whyExists && input.whyExists.length > 10) score += 6;
  if (input.evidence && input.evidence.length > 0) score += 6;
  if (input.businessImpact && input.businessImpact.length > 5) score += 6;
  if (input.recommendedAction && input.recommendedAction.length > 5) score += 6;
  if (input.expectedOutcome && input.expectedOutcome.length > 5) score += 6;

  // Confidence (20%)
  score += Math.round(confidence * 20);

  // Priority alignment (15%)
  const highPriorityTypes = ["escalation", "critical_alert", "warning", "approval_request"];
  const isHighPriorityType = highPriorityTypes.includes(input.communicationType);
  const priority = input.priority || "medium";
  if (isHighPriorityType && (priority === "high" || priority === "critical")) score += 15;
  else if (!isHighPriorityType && (priority === "low" || priority === "medium")) score += 15;
  else if (isHighPriorityType || priority === "high" || priority === "critical") score += 8;

  // Business context (15%)
  const hasContext = input.relatedTaskId || input.relatedCustomerId || input.relatedInvoiceId ||
    input.relatedContractId || input.relatedApprovalId;
  if (hasContext) score += 15;

  // Actionable (10%)
  if (input.actionButtons && input.actionButtons.length > 0) score += 10;

  // Subject + summary quality (10%)
  if (input.subject && input.subject.length >= 10 && input.subject.length <= 120) score += 5;
  if (input.summary && input.summary.length >= 20 && input.summary.length <= 300) score += 5;

  return Math.min(100, score);
}

// ─── 3. Thread Management ────────────────────────────────────────────────────

/**
 * Replies to an existing communication. Creates a new message in the same thread.
 */
export async function replyToCommunication(
  communicationId: string,
  replyInput: Omit<CommunicationInput, "threadId" | "parentCommunicationId">
): Promise<{ id: string; isDuplicate: boolean; isThrottled: boolean; qualityScore: number }> {
  const original = await db.employeeCommunication.findUnique({
    where: { id: communicationId },
    select: { threadId: true, workspaceId: true },
  });

  if (!original) {
    throw new Error("Original communication not found");
  }

  return createCommunication({
    ...replyInput,
    workspaceId: original.workspaceId,
    threadId: original.threadId || undefined,
    parentCommunicationId: communicationId,
  });
}

// ─── 4. Communication Actions ────────────────────────────────────────────────

/**
 * Marks a communication as read.
 */
export async function markAsRead(communicationId: string): Promise<void> {
  const comm = await db.employeeCommunication.findUnique({
    where: { id: communicationId },
    select: { workspaceId: true, status: true, readAt: true, senderEmployeeId: true },
  });
  if (!comm || comm.readAt) return;

  await db.employeeCommunication.update({
    where: { id: communicationId },
    data: {
      status: comm.status === "sent" || comm.status === "delivered" ? "read" : comm.status,
      readAt: new Date(),
    },
  });

  await emitAudit(comm.workspaceId, "communication_read", "communication", communicationId, {});
}

/**
 * Acknowledges a communication (receiver confirms they've seen it and will act).
 */
export async function acknowledgeCommunication(
  communicationId: string,
  acknowledgedBy: string,
  acknowledgedByName: string
): Promise<void> {
  const comm = await db.employeeCommunication.findUnique({
    where: { id: communicationId },
    select: { workspaceId: true, senderEmployeeId: true, createdAt: true },
  });
  if (!comm) return;

  const now = new Date();
  const responseTimeMs = comm.createdAt ? now.getTime() - new Date(comm.createdAt).getTime() : null;

  await db.employeeCommunication.update({
    where: { id: communicationId },
    data: {
      status: "acknowledged",
      acknowledgedAt: now,
      responseTimeMs,
      responseAction: "acknowledge",
    },
  });

  await emitAudit(comm.workspaceId, "communication_acknowledged", "communication", communicationId, {
    acknowledgedBy,
    acknowledgedByName,
    responseTimeMs: String(responseTimeMs || 0),
  });

  // Record memory for the sender employee (communication effectiveness)
  if (comm.senderEmployeeId) {
    await recordCommunicationMemory(comm.senderEmployeeId, comm.workspaceId, communicationId, "acknowledged", responseTimeMs);
  }
}

/**
 * Resolves a communication (the issue is handled, no further action needed).
 */
export async function resolveCommunication(
  communicationId: string,
  resolvedBy: string,
  resolvedByName: string,
  resolutionNote?: string
): Promise<void> {
  const comm = await db.employeeCommunication.findUnique({
    where: { id: communicationId },
    select: { workspaceId: true, threadId: true, senderEmployeeId: true, createdAt: true },
  });
  if (!comm) return;

  const now = new Date();
  const responseTimeMs = comm.createdAt ? now.getTime() - new Date(comm.createdAt).getTime() : null;

  await db.employeeCommunication.update({
    where: { id: communicationId },
    data: {
      status: "resolved",
      resolvedAt: now,
      responseTimeMs,
      responseAction: "resolve",
    },
  });

  // If this message is in a thread, resolve the thread too
  if (comm.threadId) {
    await db.communicationThread.update({
      where: { id: comm.threadId },
      data: {
        status: "resolved",
        resolvedAt: now,
      },
    }).catch(() => {});
  }

  await emitAudit(comm.workspaceId, "communication_resolved", "communication", communicationId, {
    resolvedBy,
    resolvedByName,
    resolutionNote: resolutionNote || "",
    responseTimeMs: String(responseTimeMs || 0),
  });

  // Record memory for the sender employee
  if (comm.senderEmployeeId) {
    await recordCommunicationMemory(comm.senderEmployeeId, comm.workspaceId, communicationId, "resolved", responseTimeMs);
  }
}

/**
 * Escalates a communication (raises priority + notifies higher authority).
 */
export async function escalateCommunication(
  communicationId: string,
  escalatedBy: string,
  escalatedByName: string,
  reason: string
): Promise<void> {
  const comm = await db.employeeCommunication.findUnique({
    where: { id: communicationId },
    select: { workspaceId: true, threadId: true, senderEmployeeId: true, priority: true, subject: true, createdAt: true },
  });
  if (!comm) return;

  const now = new Date();
  const newPriority = comm.priority === "critical" ? "critical" : comm.priority === "high" ? "critical" : "high";

  await db.employeeCommunication.update({
    where: { id: communicationId },
    data: {
      status: "escalated",
      escalatedAt: now,
      priority: newPriority,
      responseAction: "escalate",
    },
  });

  if (comm.threadId) {
    await db.communicationThread.update({
      where: { id: comm.threadId },
      data: {
        status: "escalated",
        priority: newPriority,
      },
    }).catch(() => {});
  }

  await emitAudit(comm.workspaceId, "communication_escalated", "communication", communicationId, {
    escalatedBy,
    escalatedByName,
    reason,
    newPriority,
  });

  // Record memory
  if (comm.senderEmployeeId) {
    await recordCommunicationMemory(comm.senderEmployeeId, comm.workspaceId, communicationId, "escalated", null);
  }
}

// ─── 5. Employee-to-Employee Communication ───────────────────────────────────

/**
 * Sends a coordination message from one AI Employee to another.
 * This enables employee-to-employee handoffs.
 *
 * Example:
 *   Finance Employee → Back Office Employee
 *   "Invoice requires missing GST document."
 *
 *   Back Office → Finance (reply)
 *   "Document uploaded."
 *   → Finance resumes automatically.
 */
export async function sendEmployeeCoordination(
  fromEmployeeId: string,
  toEmployeeId: string,
  workspaceId: string,
  params: {
    subject: string;
    summary: string;
    explanation: string;
    communicationType: CommunicationType;
    priority?: Priority;
    relatedTaskId?: string;
    relatedInvoiceId?: string;
    relatedCustomerId?: string;
    whyExists: string;
    businessImpact: string;
    recommendedAction: string;
    expectedOutcome: string;
    evidence?: Array<{ source: string; fact: string; weight: string }>;
    confidence?: number;
  }
): Promise<{ id: string; isDuplicate: boolean; isThrottled: boolean; qualityScore: number }> {
  const [fromEmp, toEmp] = await Promise.all([
    db.employee.findUnique({ where: { id: fromEmployeeId }, select: { name: true } }),
    db.employee.findUnique({ where: { id: toEmployeeId }, select: { name: true } }),
  ]);

  if (!fromEmp || !toEmp) {
    throw new Error("Employee not found");
  }

  return createCommunication({
    workspaceId,
    senderEmployeeId: fromEmployeeId,
    senderName: fromEmp.name,
    senderType: "employee",
    receiverType: "employee",
    receiverEmployeeId: toEmployeeId,
    receiverName: toEmp.name,
    communicationType: params.communicationType,
    priority: params.priority || "medium",
    subject: params.subject,
    summary: params.summary,
    explanation: params.explanation,
    relatedTaskId: params.relatedTaskId,
    relatedInvoiceId: params.relatedInvoiceId,
    relatedCustomerId: params.relatedCustomerId,
    whyExists: params.whyExists,
    evidence: params.evidence,
    confidence: params.confidence,
    businessImpact: params.businessImpact,
    recommendedAction: params.recommendedAction,
    expectedOutcome: params.expectedOutcome,
  });
}

// ─── 6. Memory + Learning Integration ────────────────────────────────────────

/**
 * Records a communication outcome as permanent memory.
 * This enables the Learning Engine to track:
 *   - Communication effectiveness (was it acknowledged/resolved/ignored?)
 *   - Response times (how long did the receiver take?)
 *   - Human acceptance (approved vs rejected)
 *   - False alerts (ignored messages)
 *   - Successful escalations
 */
async function recordCommunicationMemory(
  employeeId: string,
  workspaceId: string,
  communicationId: string,
  outcome: string,
  responseTimeMs: number | null
): Promise<void> {
  try {
    const { recordMemory } = await import("@/lib/memory/service");
    await recordMemory(employeeId, workspaceId, {
      memoryType: "strategy_effectiveness",
      entityType: "communication",
      entityId: communicationId,
      entityLabel: `Communication ${outcome}`,
      key: `comm_outcome_${outcome}`,
      value: {
        outcome,
        responseTimeMs: String(responseTimeMs || 0),
        recordedAt: new Date().toISOString(),
      },
      source: "communication_engine",
    });
  } catch (err) {
    console.error("[Communication] Memory recording failed:", err);
  }
}

// ─── 7. Retrieval Functions (for APIs) ───────────────────────────────────────

export interface CommunicationQuery {
  status?: CommunicationStatus | "all";
  priority?: Priority | "all";
  communicationType?: CommunicationType | "all";
  receiverType?: ReceiverType | "all";
  employeeId?: string;
  customerId?: string;
  taskId?: string;
  invoiceId?: string;
  search?: string;
  limit?: number;
}

export async function listCommunications(workspaceId: string, query: CommunicationQuery = {}) {
  const where: any = { workspaceId };

  if (query.status && query.status !== "all") {
    where.status = query.status;
  }
  if (query.priority && query.priority !== "all") {
    where.priority = query.priority;
  }
  if (query.communicationType && query.communicationType !== "all") {
    where.communicationType = query.communicationType;
  }
  if (query.receiverType && query.receiverType !== "all") {
    where.receiverType = query.receiverType;
  }
  if (query.employeeId) {
    where.OR = [
      { senderEmployeeId: query.employeeId },
      { receiverEmployeeId: query.employeeId },
    ];
  }
  if (query.customerId) {
    where.relatedCustomerId = query.customerId;
  }
  if (query.taskId) {
    where.relatedTaskId = query.taskId;
  }
  if (query.invoiceId) {
    where.relatedInvoiceId = query.invoiceId;
  }
  if (query.search) {
    where.OR = [
      { subject: { contains: query.search } },
      { summary: { contains: query.search } },
      { explanation: { contains: query.search } },
    ];
  }

  return db.employeeCommunication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(100, query.limit || 50),
  });
}

export async function getCommunicationThreads(workspaceId: string, limit = 50) {
  return db.communicationThread.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    take: Math.min(100, limit),
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1, // just the latest message
      },
    },
  });
}

export async function getThreadMessages(threadId: string) {
  return db.employeeCommunication.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCommunicationStats(workspaceId: string) {
  const [total, unread, critical, waiting, resolved, escalated, byType, byPriority] = await Promise.all([
    db.employeeCommunication.count({ where: { workspaceId } }),
    db.employeeCommunication.count({ where: { workspaceId, status: { in: ["sent", "delivered"] } } }),
    db.employeeCommunication.count({ where: { workspaceId, priority: "critical", status: { notIn: ["resolved", "ignored"] } } }),
    db.employeeCommunication.count({ where: { workspaceId, status: { in: ["acknowledged"] } } }),
    db.employeeCommunication.count({ where: { workspaceId, status: "resolved" } }),
    db.employeeCommunication.count({ where: { workspaceId, status: "escalated" } }),
    db.employeeCommunication.groupBy({ by: ["communicationType"], where: { workspaceId }, _count: true }),
    db.employeeCommunication.groupBy({ by: ["priority"], where: { workspaceId }, _count: true }),
  ]);

  // Compute average response time for resolved communications
  const resolvedComms = await db.employeeCommunication.findMany({
    where: { workspaceId, status: "resolved", responseTimeMs: { not: null } },
    select: { responseTimeMs: true },
    take: 100,
  });
  const avgResponseTimeMs = resolvedComms.length > 0
    ? resolvedComms.reduce((s, c) => s + (c.responseTimeMs || 0), 0) / resolvedComms.length
    : null;

  return {
    total,
    unread,
    critical,
    waiting,
    resolved,
    escalated,
    avgResponseTimeMs,
    byType: byType.reduce((acc, b) => ({ ...acc, [b.communicationType]: b._count }), {}),
    byPriority: byPriority.reduce((acc, b) => ({ ...acc, [b.priority]: b._count }), {}),
  };
}

// ─── 8. Priority Helpers ─────────────────────────────────────────────────────

function escalatePriority(newPriority: string, currentPriority: string): string {
  const order = { low: 0, medium: 1, high: 2, critical: 3 };
  const newLevel = (order as any)[newPriority] || 1;
  const currentLevel = (order as any)[currentPriority] || 1;
  return newLevel > currentLevel ? newPriority : currentPriority;
}

// ─── Audit Helper ────────────────────────────────────────────────────────────

async function emitAudit(
  workspaceId: string,
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
        actorName: "Communication Engine",
        targetType,
        targetId,
        payload,
      });
    });
  } catch (err) {
    console.error(`[Communication] Audit emission failed for ${entryType}:`, err);
  }
}

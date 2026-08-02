/**
 * BIHARI AI — Employee Profile Engine (EMP-001)
 *
 * Every AI Employee has one persistent profile representing its professional career.
 * Think: LinkedIn profile + performance review + resume + trust history.
 *
 * The profile is automatically updated after every:
 * - Task completion (XP, KPIs, skills, trust)
 * - Approval decision (approval rate, trust, XP)
 * - Memory update (memory count, reinforcement count)
 * - Capability grant/revoke (capabilities count)
 * - Contract approval/rejection (contract success rate, trust)
 * - Capability denial (risk score, trust penalty)
 *
 * The engine is GENERIC — not finance-specific. Every future employee
 * (HR, Sales Ops, Procurement, etc.) uses exactly the same engine.
 *
 * Architecture:
 * - EmployeeProfile: the persistent career record (one per employee)
 * - EmployeeSkill: individual skills with level, confidence, usage count
 * - XP/Level system: weighted scoring based on real outcomes
 * - Trust score: composite of approval rate, contract success, violations
 * - Auto-inferred skills: extracted from task patterns
 */

import { db } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProfileUpdateEvent {
  type:
    | "task_completed"
    | "task_failed"
    | "approval_approved"
    | "approval_rejected"
    | "contract_approved"
    | "contract_rejected"
    | "capability_denied"
    | "human_override"
    | "reminder_sent"
    | "money_recovered"
    | "memory_created"
    | "memory_reinforced";
  employeeId: string;
  workspaceId: string;
  taskId?: string;
  amount?: number; // for money_recovered (in paise)
  toolName?: string;
  confidence?: number;
  executionTimeMs?: number;
}

export interface SkillDefinition {
  name: string;
  // Keywords in task title/description that indicate this skill was used
  keywords: string[];
  // Tools that exercise this skill
  tools: string[];
}

// ─── XP / Level System ───────────────────────────────────────────────────────

// XP rewards per event type.
// NOTE: contract_approved / contract_rejected / human_override are intentionally
// ZERO XP because they always co-occur with approval_approved / approval_rejected
// (every approval is linked 1:1 to a contract). Double-counting would inflate
// XP. These events still drive OTHER profile fields (humanInterventionRate,
// accuracyScore, audit timeline) via the switch in recordProfileEvent().
const XP_REWARDS: Record<string, number> = {
  task_completed: 10,
  approval_approved: 8,
  reminder_sent: 3,
  money_recovered: 15,
  memory_created: 1,
  memory_reinforced: 2,
  contract_approved: 0,        // bookkeeping only — XP already counted via approval_approved
  task_failed: -5,
  approval_rejected: -4,
  contract_rejected: 0,        // bookkeeping only — XP already counted via approval_rejected
  capability_denied: -6,
  human_override: -3,          // human edited the proposed action — small trust penalty
};

const LEVELS = [
  { level: 1, title: "Intern", minXp: 0 },
  { level: 2, title: "Junior Employee", minXp: 50 },
  { level: 3, title: "Employee", minXp: 150 },
  { level: 4, title: "Senior Employee", minXp: 350 },
  { level: 5, title: "Lead Employee", minXp: 700 },
  { level: 6, title: "Principal Employee", minXp: 1200 },
  { level: 7, title: "Expert Employee", minXp: 2000 },
];

function getLevelForXp(xp: number): { level: number; title: string } {
  let result = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.minXp) result = l;
  }
  return { level: result.level, title: result.title };
}

// ─── Skill Definitions (Generic — extensible per role) ───────────────────────

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

// ─── Profile Initialization ──────────────────────────────────────────────────

/**
 * Returns the level definitions. Exposed so the UI can render the level
 * progression ladder (Intern → Junior → Employee → Senior → Lead → Principal → Expert).
 */
export function getLevelDefinitions() {
  return LEVELS.map((l) => ({ ...l }));
}

/**
 * Creates an empty profile for a new employee.
 * Called when an employee is first activated.
 */
export async function initProfile(
  employeeId: string,
  workspaceId: string,
  employeeType: string,
  department: string
): Promise<void> {
  const existing = await db.employeeProfile.findUnique({
    where: { employeeId },
  });
  if (existing) return;

  const { level, title } = getLevelForXp(0);

  await db.employeeProfile.create({
    data: {
      employeeId,
      workspaceId,
      employeeType,
      department,
      title,
      level,
      experiencePoints: 0,
    },
  });
}

// ─── Core: Record Profile Event ─────────────────────────────────────────────

/**
 * Records a profile event and updates the employee's profile accordingly.
 *
 * This is the SINGLE entry point for all profile updates. Every system
 * (executor, approval, memory, contracts, capabilities) calls this function.
 *
 * The function:
 * 1. Awards/penalizes XP based on the event type
 * 2. Updates the level if XP crossed a threshold
 * 3. Updates KPIs (tasks, emails, money, etc.)
 * 4. Updates trust score (composite)
 * 5. Updates quality metrics
 * 6. Infers and updates skills
 * 7. Updates memory/capability counts
 */
export async function recordProfileEvent(event: ProfileUpdateEvent): Promise<void> {
  const profile = await db.employeeProfile.findUnique({
    where: { employeeId: event.employeeId },
  });

  if (!profile) {
    // Auto-initialize if profile doesn't exist
    const employee = await db.employee.findUnique({
      where: { id: event.employeeId },
    });
    if (!employee) return;

    await initProfile(
      event.employeeId,
      event.workspaceId,
      employee.role,
      employee.role === "finance_employee" ? "Finance" : "General"
    );

    return recordProfileEvent(event); // Retry after init
  }

  // ─── Calculate XP delta ──────────────────────────────────────────────────
  let xpDelta = XP_REWARDS[event.type] || 0;

  // Money recovered bonus: +15 base + 1 per ₹1000 recovered
  if (event.type === "money_recovered" && event.amount) {
    xpDelta = 15 + Math.floor(event.amount / 100000); // 100000 paise = ₹1000
  }

  const newXp = Math.max(0, profile.experiencePoints + xpDelta);
  const { level, title } = getLevelForXp(newXp);

  // ─── Calculate field updates ─────────────────────────────────────────────
  const updates: Record<string, any> = {
    experiencePoints: newXp,
    level,
    title,
    version: { increment: 1 },
    updatedAt: new Date(),
  };

  // Task counters
  if (event.type === "task_completed") {
    updates.completedTasks = { increment: 1 };
    updates.successfulTasks = { increment: 1 };
    updates.tasksAutomated = { increment: 1 };
    updates.lastTaskAt = new Date();
    updates.hoursSaved = { increment: 0.25 }; // ~15 min per automated task (conservative estimate)
    if (event.executionTimeMs) {
      const newAvg = Math.round(
        (profile.averageExecutionTime * profile.completedTasks + event.executionTimeMs) /
        (profile.completedTasks + 1)
      );
      updates.averageExecutionTime = newAvg;
    }
    if (event.confidence) {
      const newAvgConf = (profile.averageConfidence * profile.completedTasks + event.confidence) /
        (profile.completedTasks + 1);
      updates.averageConfidence = newAvgConf;
    }
  }

  if (event.type === "task_failed") {
    updates.failedTasks = { increment: 1 };
  }

  // Approval rate — tracks the ratio of approved to total approval decisions.
  // Uses the profile's running counters: successfulTasks (approved) vs
  // failedTasks (rejected). This is a simplification — a true approval rate
  // would track individual approval decisions, not task outcomes. But since
  // every approval rejection leads to a task failure, this is a reasonable
  // proxy that avoids a separate counter.
  if (event.type === "approval_approved") {
    const totalDecisions = profile.completedTasks + profile.failedTasks + 1;
    const newApprovalRate = (profile.completedTasks + 1) / totalDecisions;
    updates.approvalRate = Math.min(1.0, newApprovalRate);
  }

  if (event.type === "approval_rejected") {
    const totalDecisions = profile.completedTasks + profile.failedTasks + 1;
    const newApprovalRate = profile.completedTasks / totalDecisions;
    updates.approvalRate = Math.max(0.0, newApprovalRate);
  }

  // KPIs — emailsSent, customersHandled, and invoicesProcessed are all synced
  // from the Reminder table in updateMemoryAndCapabilityCounts (count of
  // sent reminders, distinct customers, distinct invoices). They are NOT
  // incremented here because:
  // 1. The reminder_sent event fires when the approval is approved, BEFORE
  //    the worker actually executes the send_reminder tool. If the task is
  //    then cancelled or the tool fails, the counter would be wrong.
  // 2. The approval_approved event with toolName==="send_reminder" used to
  //    ALSO increment emailsSent, causing a double-count (2× per reminder).
  // DB-synced counters are the source of truth.

  if (event.type === "money_recovered" && event.amount) {
    updates.moneyRecovered = { increment: event.amount };
    updates.estimatedBusinessValue = { increment: event.amount };
  }

  // Memory counts
  if (event.type === "memory_created") {
    updates.memoryCount = { increment: 1 };
  }
  if (event.type === "memory_reinforced") {
    updates.reinforcementCount = { increment: 1 };
  }

  // Capability denial — increase risk
  if (event.type === "capability_denied") {
    updates.riskScore = Math.min(100, profile.riskScore + 5);
  }

  // Human override — manager edited the proposed action.
  // Slightly raise humanInterventionRate (capped at 1.0) and nudge risk up.
  if (event.type === "human_override") {
    const newIntervention = Math.min(1.0, profile.humanInterventionRate + 0.05);
    updates.humanInterventionRate = newIntervention;
    updates.riskScore = Math.min(100, profile.riskScore + 2);
  }

  // Contract outcomes — these are bookkeeping events (zero XP) but they
  // still nudge consistency/accuracy scores so the profile reflects the
  // contract lifecycle separately from the approval lifecycle.
  if (event.type === "contract_approved") {
    // Slight accuracy boost: the contract's reasoning was endorsed.
    updates.accuracyScore = Math.min(1.0, profile.accuracyScore + 0.005);
  }
  if (event.type === "contract_rejected") {
    // Slight accuracy penalty: the contract's reasoning was rejected.
    updates.accuracyScore = Math.max(0.0, profile.accuracyScore - 0.01);
  }

  // ─── Recalculate trust score ─────────────────────────────────────────────
  const newTrustScore = calculateTrustScore({
    approvalRate: updates.approvalRate ?? profile.approvalRate,
    failedTasks: event.type === "task_failed" ? profile.failedTasks + 1 : profile.failedTasks,
    completedTasks: event.type === "task_completed" ? profile.completedTasks + 1 : profile.completedTasks,
    riskScore: updates.riskScore ?? profile.riskScore,
    humanInterventionRate: updates.humanInterventionRate ?? profile.humanInterventionRate,
    hallucinationRate: profile.hallucinationRate,
  });
  updates.trustScore = newTrustScore;

  // ─── Apply updates ───────────────────────────────────────────────────────
  await db.employeeProfile.update({
    where: { employeeId: event.employeeId },
    data: updates,
  });

  // ─── Infer and update skills (ONLY on task completion) ───────────────────
  // Skill inference scans the task's title/description/tools and increments
  // matching skill counters. If we ran this on EVERY event (approval_approved,
  // reminder_sent, contract_approved, etc.), a single task with 2 approval
  // gates would increment skills 7+ times. We only want skills to grow once
  // per task completion.
  if (event.type === "task_completed" && event.taskId) {
    try {
      await inferAndUpdateSkills(event.employeeId, event.workspaceId, event.taskId, event.toolName);
    } catch (err) {
      console.error(`[Profile] Skill inference failed for employee ${event.employeeId}:`, err);
    }
  }

  // ─── Update memory/capability/customer/email counts ─────────────────────
  // Only sync on events that actually change the synced counters:
  // - memory_created / memory_reinforced → memory counts change
  // - task_completed → all synced counters may have changed
  // - reminder_sent → emailsSent/customersHandled/invoicesProcessed may change
  //   (the reminder_sent event fires when the approval is approved; the
  //   actual reminder row is created/sent by the worker shortly after.
  //   We sync here AND on task_completed to catch both timing windows.)
  // Running this on every event caused 3 DB queries × ~90 events = ~270
  // redundant queries per task.
  if (
    event.type === "memory_created" ||
    event.type === "memory_reinforced" ||
    event.type === "task_completed" ||
    event.type === "reminder_sent"
  ) {
    try {
      await updateMemoryAndCapabilityCounts(event.employeeId, event.workspaceId);
    } catch (err) {
      console.error(`[Profile] Count update failed for employee ${event.employeeId}:`, err);
    }
  }
}

// ─── Trust Score Calculation ─────────────────────────────────────────────────

function calculateTrustScore(params: {
  approvalRate: number;
  completedTasks: number;
  failedTasks: number;
  riskScore: number;
  humanInterventionRate: number;
  hallucinationRate: number;
}): number {
  const totalTasks = params.completedTasks + params.failedTasks;
  if (totalTasks === 0) return 85.0;

  // Weighted components (each contributes to a 0-100 score)
  const approvalScore = params.approvalRate * 35;        // 35% weight
  const successScore = totalTasks > 0
    ? (params.completedTasks / totalTasks) * 25            // 25% weight
    : 25;
  const riskScore = (100 - params.riskScore) * 0.15;     // 15% weight (inverse)
  const interventionScore = (1 - params.humanInterventionRate) * 15; // 15% weight
  const hallucinationScore = (1 - params.hallucinationRate) * 10;   // 10% weight

  return Math.round((approvalScore + successScore + riskScore + interventionScore + hallucinationScore) * 10) / 10;
}

// ─── Skill Inference ────────────────────────────────────────────────────────

/**
 * Infers which skills were used in a task and updates skill levels.
 * Skills are inferred from:
 * - Task title and description keywords
 * - Tools used in the task
 */
async function inferAndUpdateSkills(
  employeeId: string,
  workspaceId: string,
  taskId: string,
  toolName?: string
): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { steps: true },
  });

  if (!task) return;

  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return;

  const skillDefs = getSkillsForRole(employee.role);
  const taskText = `${task.title} ${task.description}`.toLowerCase();
  const toolsUsed = new Set<string>();
  if (toolName) toolsUsed.add(toolName);
  for (const step of task.steps) {
    try {
      const input = JSON.parse(step.input);
      if (input.tool) toolsUsed.add(input.tool);
    } catch {}
  }

  // Find which skills were exercised
  for (const skillDef of skillDefs) {
    const usedByKeyword = skillDef.keywords.some((kw) => taskText.includes(kw.toLowerCase()));
    const usedByTool = skillDef.tools.some((t) => toolsUsed.has(t));

    if (usedByKeyword || usedByTool) {
      // Update or create the skill
      const existing = await db.employeeSkill.findUnique({
        where: { employeeId_name: { employeeId, name: skillDef.name } },
      });

      if (existing) {
        // Increase level every 5 uses, cap at 10
        const newUsageCount = existing.usageCount + 1;
        const newLevel = Math.min(10, Math.floor(newUsageCount / 5) + 1);
        // Increase confidence, cap at 0.99
        const newConfidence = Math.min(0.99, existing.confidence + 0.05);

        await db.employeeSkill.update({
          where: { id: existing.id },
          data: {
            usageCount: newUsageCount,
            level: newLevel,
            confidence: newConfidence,
            lastUsedAt: new Date(),
          },
        });
      } else {
        await db.employeeSkill.create({
          data: {
            employeeId,
            workspaceId,
            name: skillDef.name,
            level: 1,
            confidence: 0.5,
            usageCount: 1,
            lastUsedAt: new Date(),
          },
        });
      }
    }
  }

  // Update the skills JSON on the profile for quick access
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

// ─── Memory & Capability Count Sync ──────────────────────────────────────────

/**
 * Syncs derived counters from canonical sources:
 * - memoryCount, reinforcementCount ← EmployeeMemory table
 * - capabilitiesGranted, criticalCapabilities ← EmployeeCapability table
 * - customersHandled, invoicesProcessed ← Reminder table (distinct customer/invoice IDs)
 *
 * Called after memory events and task completion. NOT called on every profile
 * event (would cause ~270 redundant queries per task).
 *
 * NOTE: Prisma's `count()` does NOT support `include` (it conflicts with the
 * implicit `select: { _count }`). We use `findMany` with a projected `select`
 * on the related Capability row instead.
 *
 * NOTE: customersHandled/invoicesProcessed are derived from the Reminder table
 * (distinct customerId/invoiceId where createdBy = employeeId). This is
 * finance-specific in practice but the query itself is generic — any employee
 * that creates reminders gets credit for the customers/invoices it touched.
 * Employees that never create reminders (HR, Sales Ops, etc.) will have these
 * counters stay at 0, which is correct.
 */
async function updateMemoryAndCapabilityCounts(
  employeeId: string,
  _workspaceId: string
): Promise<void> {
  const [memoryCount, reinforcementAgg, allCaps, reminderAgg, sentReminders, distinctInvoices] = await Promise.all([
    db.employeeMemory.count({ where: { employeeId } }),
    db.employeeMemory.aggregate({
      where: { employeeId },
      _sum: { reinforcementCount: true },
    }),
    db.employeeCapability.findMany({
      where: { employeeId },
      include: { capability: { select: { riskLevel: true } } },
    }),
    // Distinct customers from reminders created by this employee.
    db.reminder.groupBy({
      by: ["customerId"],
      where: { createdBy: employeeId },
    }),
    // Count of reminders actually SENT (status = "sent") by this employee.
    // This is the source of truth for emailsSent — not event increments.
    db.reminder.count({
      where: { createdBy: employeeId, status: "sent" },
    }),
    // Distinct invoices from reminders created by this employee.
    db.reminder.groupBy({
      by: ["invoiceId"],
      where: { createdBy: employeeId },
    }),
  ]);

  const criticalCaps = allCaps.filter(
    (c) =>
      c.capability.riskLevel === "critical" ||
      c.capability.riskLevel === "high"
  ).length;

  await db.employeeProfile.update({
    where: { employeeId },
    data: {
      memoryCount,
      reinforcementCount: reinforcementAgg._sum.reinforcementCount || 0,
      capabilitiesGranted: allCaps.length,
      criticalCapabilities: criticalCaps,
      emailsSent: sentReminders,
      customersHandled: reminderAgg.length,
      invoicesProcessed: distinctInvoices.length,
    },
  });
}

// ─── Profile Retrieval ───────────────────────────────────────────────────────

/**
 * Recomputes the derived/synced fields of a profile from canonical sources:
 * memory count, reinforcement count, capability counts. Used by backfill
 * scripts and as a consistency check after schema migrations.
 *
 * NOTE: This does NOT recompute XP, trust, KPIs, or skills — those are
 * event-driven and accumulated over time. Only the "synced" counters
 * (which mirror state in other tables) are recomputed.
 */
export async function recalcProfileSyncedCounts(employeeId: string): Promise<void> {
  await updateMemoryAndCapabilityCounts(employeeId, "");
}

export async function getProfile(employeeId: string) {
  const profile = await db.employeeProfile.findUnique({
    where: { employeeId },
  });

  if (!profile) return null;

  return {
    ...profile,
    skills: JSON.parse(profile.skills),
    knowledgeAreas: JSON.parse(profile.knowledgeAreas),
    specializations: JSON.parse(profile.specializations),
    strongestDomains: JSON.parse(profile.strongestDomains),
    weakDomains: JSON.parse(profile.weakDomains),
    // Derived
    nextLevelXp: getNextLevelXp(profile.experiencePoints),
    progressToNextLevel: getProgressToNextLevel(profile.experiencePoints),
  };
}

export async function getPerformance(employeeId: string) {
  const profile = await db.employeeProfile.findUnique({
    where: { employeeId },
  });

  if (!profile) return null;

  // Get recent tasks
  const recentTasks = await db.task.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      status: true,
      stepCount: true,
      tokenUsage: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });

  // Get recent approvals
  const recentApprovals = await db.approval.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      tool: true,
      toolDisplayName: true,
      status: true,
      decision: true,
      createdAt: true,
      decidedAt: true,
    },
  });

  // Get skills
  const skills = await db.employeeSkill.findMany({
    where: { employeeId },
    orderBy: { usageCount: "desc" },
  });

  return {
    profile: {
      level: profile.level,
      title: profile.title,
      experiencePoints: profile.experiencePoints,
      trustScore: profile.trustScore,
      accuracyScore: profile.accuracyScore,
      consistencyScore: profile.consistencyScore,
      riskScore: profile.riskScore,
      approvalRate: profile.approvalRate,
      averageConfidence: profile.averageConfidence,
      averageExecutionTime: profile.averageExecutionTime,
    },
    kpis: {
      moneyRecovered: profile.moneyRecovered,
      invoicesProcessed: profile.invoicesProcessed,
      customersHandled: profile.customersHandled,
      emailsSent: profile.emailsSent,
      tasksAutomated: profile.tasksAutomated,
      hoursSaved: profile.hoursSaved,
      estimatedBusinessValue: profile.estimatedBusinessValue,
    },
    memory: {
      memoryCount: profile.memoryCount,
      reinforcementCount: profile.reinforcementCount,
    },
    capabilities: {
      capabilitiesGranted: profile.capabilitiesGranted,
      criticalCapabilities: profile.criticalCapabilities,
    },
    recentTasks,
    recentApprovals,
    skills: skills.map((s) => ({
      name: s.name,
      level: s.level,
      confidence: s.confidence,
      usageCount: s.usageCount,
      lastUsedAt: s.lastUsedAt,
    })),
  };
}

export async function getHistory(employeeId: string) {
  // Get audit entries for this employee
  const auditEntries = await db.auditLog.findMany({
    where: {
      OR: [
        { actorId: employeeId },
        { targetType: "employee", targetId: employeeId },
      ],
    },
    orderBy: { sequenceNumber: "desc" },
    take: 50,
  });

  return auditEntries.map((e) => ({
    id: e.id,
    sequenceNumber: e.sequenceNumber,
    entryType: e.entryType,
    actorType: e.actorType,
    actorName: e.actorName,
    targetType: e.targetType,
    targetId: e.targetId,
    payload: JSON.parse(e.payload),
    createdAt: e.createdAt,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNextLevelXp(currentXp: number): number {
  const current = getLevelForXp(currentXp);
  const nextLevel = LEVELS.find((l) => l.level === current.level + 1);
  return nextLevel ? nextLevel.minXp : currentXp; // Max level
}

function getProgressToNextLevel(currentXp: number): number {
  const current = getLevelForXp(currentXp);
  const nextLevel = LEVELS.find((l) => l.level === current.level + 1);
  if (!nextLevel) return 100; // Max level
  const range = nextLevel.minXp - current.minXp;
  const progress = (currentXp - current.minXp) / range;
  return Math.round(progress * 100);
}

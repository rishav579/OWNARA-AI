/**
 * BIHARI AI — Mandate Supervisor
 *
 * The continuous-execution loop that makes a Mandate ALIVE. Without this, a
 * Mandate is just a declaration. With it, a Mandate continuously:
 *
 *   OBSERVE  → read the current state of the domain (e.g. overdue rate)
 *   REASON   → compare against the desired state + success criteria
 *   ACT      → if the desired state is not met, spawn a Task (episode) to
 *              make progress — within the Mandate's granted authority
 *   REQUEST AUTHORITY → the spawned task's approval gates enforce the boundary
 *   LEARN    → the learning engine evaluates each completed episode
 *   MEASURE  → recompute the health score
 *   ADAPT    → the accumulated memory changes future behavior
 *
 * The supervisor runs on every worker poll cycle. It is idempotent: if a
 * Mandate already has a recent in-progress episode, it does not spawn another
 * (prevents episode flooding). The spawn interval is configurable.
 *
 * This is what makes the Mandate fundamentally different from a task: a task
 * executes once and dies. A Mandate pursues its desired state FOREVER, spawning
 * episodes as needed, learning from each one, and never stopping until the
 * state is sustained or the grantor revokes it.
 */

import { db } from "@/lib/db";
import { appendAudit } from "@/lib/runtime/audit";
import { evaluateMandateHealth } from "@/lib/mandate/engine";
import { observeMandateState, selectStrategy, type SelectedStrategy } from "@/lib/mandate/strategy-selector";

/** Minimum time between spawned episodes for the same Mandate (10 minutes). */
const MIN_EPISODE_INTERVAL_MS = 10 * 60 * 1000;
/** Don't spawn if there's already an active (queued/executing/waiting) episode. */
const MAX_CONCURRENT_EPISODES = 1;

/**
 * Runs one supervisor cycle: evaluates all active Mandates and spawns episodes
 * for any whose desired state is not being met.
 *
 * Called by the worker on each poll (every 2s), but the internal interval
 * guard prevents over-spawning.
 */
export async function superviseMandates(): Promise<void> {
  // Find all active mandates with a tenant assigned
  const activeMandates = await db.mandate.findMany({
    where: { status: "active", tenantId: { not: null } },
    select: {
      id: true,
      workspaceId: true,
      title: true,
      declaration: true,
      tenantId: true,
      healthScore: true,
      lastEvaluatedAt: true,
    },
  });

  for (const mandate of activeMandates) {
    try {
      await superviseOne(mandate);
    } catch (err) {
      console.error(`[Mandate Supervisor] Error supervising ${mandate.id}:`, err);
    }
  }
}

async function superviseOne(mandate: {
  id: string;
  workspaceId: string;
  title: string;
  declaration: string;
  tenantId: string | null;
  healthScore: number;
  lastEvaluatedAt: Date | null;
}): Promise<void> {
  // ─── OBSERVE + MEASURE: re-evaluate health from live data ──────────────
  await evaluateMandateHealth(mandate.id);
  const fresh = await db.mandate.findUnique({
    where: { id: mandate.id },
    select: { healthScore: true, healthNote: true, lastEvaluatedAt: true },
  });

  if (!fresh) return;

  // ─── REASON: is the desired state being met? ──────────────────────────
  if (fresh.healthScore >= 100) {
    return; // Desired state is sustained — no episode needed.
  }

  // ─── Throttle: don't spawn if there's already an active episode ─────────
  const activeEpisodes = await db.task.count({
    where: {
      mandateId: mandate.id,
      status: { in: ["queued", "executing", "waiting_approval", "planning"] },
    },
  });
  if (activeEpisodes >= MAX_CONCURRENT_EPISODES) {
    return;
  }

  const lastEpisode = await db.task.findFirst({
    where: { mandateId: mandate.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, status: true },
  });
  if (lastEpisode) {
    const ageMs = Date.now() - new Date(lastEpisode.createdAt).getTime();
    if (ageMs < MIN_EPISODE_INTERVAL_MS) {
      return;
    }
  }

  // ─── OBSERVE (deep): read the actual domain state ─────────────────────
  // This is what makes the Mandate NOT a fixed workflow. The supervisor
  // observes the REAL state of invoices, customers, collection cases, and
  // reminders — then selects a strategy appropriate to what it sees.
  const observedState = await observeMandateState(mandate.workspaceId);

  // ─── RETRIEVE MEMORY: load the Mandate's accumulated learning ──────────
  // This closes the memory loop. The strategy selector uses past memory to
  // influence its reasoning — customer patterns, strategy outcomes, approval
  // feedback, and outcome lessons all shape the next strategy selection.
  const memoryEntries = await db.mandateMemory.findMany({
    where: { mandateId: mandate.id, supersededAt: null },
    orderBy: { importance: "desc" },
    take: 20,
    select: { id: true, memoryType: true, content: true, importance: true },
  });

  // ─── REASON (deep): select a strategy based on observed state + memory ─
  // Different states produce DIFFERENT episodes. Memory from past episodes
  // influences the reasoning. This is the proof that the Mandate is a
  // control system that LEARNS, not a fixed workflow.
  const strategy = selectStrategy(
    observedState,
    mandate.title,
    mandate.declaration,
    memoryEntries.map((m) => ({
      id: m.id,
      memoryType: m.memoryType,
      content: m.content,
      importance: m.importance,
    }))
  );
  if (!strategy) {
    // No actionable gap — the observed state doesn't warrant an episode.
    return;
  }

  // ─── ACT: spawn an episode using the selected strategy ─────────────────
  await spawnEpisode(mandate, strategy);
}

/**
 * Spawns a Task (episode) under the Mandate using the selected strategy.
 *
 * The episode title, description, and priority are all derived from the
 * strategy — NOT hardcoded. Different strategies produce fundamentally
 * different episodes:
 *   • investigate_disputed → "Investigate disputed invoice INV-001..."
 *   • prioritize_high_value → "Prioritize recovery from BlueDart..."
 *   • send_reminder_campaign → "Send reminders for 3 overdue invoices"
 *   • wait_for_promise → no episode (strategy returns null)
 *
 * The strategy reasoning is stored in the task description so the grantor
 * can see WHY this episode was chosen. The strategy type is parsed by the
 * memory extractor to generate strategy-specific learnings.
 */
async function spawnEpisode(
  mandate: { id: string; workspaceId: string; title: string; declaration: string; tenantId: string | null },
  strategy: SelectedStrategy
): Promise<void> {
  if (!mandate.tenantId) return;

  const fullMandate = await db.mandate.findUnique({
    where: { id: mandate.id },
    select: { grantorId: true },
  });
  if (!fullMandate) return;

  await db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        workspaceId: mandate.workspaceId,
        employeeId: mandate.tenantId!,
        assignedBy: fullMandate.grantorId,
        title: strategy.episodeTitle,
        description: strategy.episodeDescription,
        status: "queued",
        priority: strategy.priority,
        mandateId: mandate.id,
      },
    });

    await appendAudit(tx, {
      workspaceId: mandate.workspaceId,
      entryType: "mandate_episode_spawned",
      actorType: "system",
      actorId: null,
      actorName: "Mandate Supervisor",
      targetType: "mandate",
      targetId: mandate.id,
      payload: {
        taskId: task.id,
        strategy: strategy.strategy,
        reasoning: strategy.reasoning.slice(0, 200),
        observedOverdueRate: String((strategy.observedState.overdueRate * 100).toFixed(1)),
        observedOverdueCount: String(strategy.observedState.overdueInvoiceCount),
        memoryUsed: JSON.stringify(strategy.memoryUsed.map((m) => ({ id: m.id, type: m.memoryType }))),
      },
    });

    console.log(`[Mandate Supervisor] Spawned episode ${task.id} for mandate ${mandate.id} — strategy: ${strategy.strategy}, memory used: ${strategy.memoryUsed.length}`);
  });
}

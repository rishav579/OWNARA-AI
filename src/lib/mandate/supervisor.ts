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
    // Desired state is sustained — no episode needed.
    return;
  }

  // ─── Throttle: don't spawn if there's already an active episode ─────────
  // (prevents episode flooding. The 10-min interval is enforced by checking
  // the most recent task's creation time — if the last episode was < 10 min
  // ago, wait for it to finish before spawning another.)
  const activeEpisodes = await db.task.count({
    where: {
      mandateId: mandate.id,
      status: { in: ["queued", "executing", "waiting_approval", "planning"] },
    },
  });
  if (activeEpisodes >= MAX_CONCURRENT_EPISODES) {
    return; // An episode is already in progress — let it finish
  }

  // Check the last spawned episode's age — don't re-spawn too frequently
  const lastEpisode = await db.task.findFirst({
    where: { mandateId: mandate.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, status: true },
  });
  if (lastEpisode) {
    const ageMs = Date.now() - new Date(lastEpisode.createdAt).getTime();
    if (ageMs < MIN_EPISODE_INTERVAL_MS) {
      return; // Recently spawned an episode — wait
    }
  }

  // ─── ACT: spawn an episode (Task) to make progress toward the desired state ─
  await spawnEpisode(mandate, fresh.healthScore, fresh.healthNote || "");
}

/**
 * Spawns a Task (episode) under the Mandate. The task is linked to the Mandate
 * via mandateId, assigned to the Mandate's tenant, and given a title that
 * reflects the current gap between desired and actual state.
 *
 * The task then flows through the normal trust loop (plan → approve → execute
 * → audit → evaluate), and the learning engine feeds back into Mandate memory.
 */
async function spawnEpisode(
  mandate: { id: string; workspaceId: string; title: string; declaration: string; tenantId: string | null },
  healthScore: number,
  healthNote: string
): Promise<void> {
  if (!mandate.tenantId) return;

  // Find the grantor (to assign the task)
  const fullMandate = await db.mandate.findUnique({
    where: { id: mandate.id },
    select: { grantorId: true },
  });
  if (!fullMandate) return;

  // Build a task title that reflects the current gap
  const episodeTitle = `Pursue: ${mandate.title} (health ${Math.round(healthScore)}%)`;
  const episodeDesc = `Auto-spawned by the Mandate Supervisor. The desired state is not yet met.\n\nMandate: ${mandate.title}\nDeclaration: ${mandate.declaration}\nCurrent health: ${Math.round(healthScore)}% — ${healthNote}\n\nAction: Identify overdue invoices that are pushing the overdue rate above target, and pursue resolution within granted authority.`;

  await db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        workspaceId: mandate.workspaceId,
        employeeId: mandate.tenantId,
        assignedBy: fullMandate.grantorId,
        title: episodeTitle,
        description: episodeDesc,
        status: "queued",
        priority: healthScore < 50 ? "high" : "medium",
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
        healthScore: String(Math.round(healthScore)),
        reason: "Desired state not met — supervisor spawned an episode to make progress",
      },
    });

    console.log(`[Mandate Supervisor] Spawned episode ${task.id} for mandate ${mandate.id} (health ${Math.round(healthScore)}%)`);
  });
}

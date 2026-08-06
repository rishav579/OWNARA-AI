/**
 * BIHARI AI — Worker Poll Loop
 *
 * Continuously polls for runnable tasks and processes them one step at a time.
 *
 * The worker claims a task atomically via PostgreSQL SELECT ... FOR UPDATE
 * SKIP LOCKED. This guarantees that multiple workers can never pick up the
 * same task simultaneously.
 *
 * State machine:
 *   queued → planning → executing → waiting_approval → executing → completed
 *                                      ↓ (rejected)
 *                                   failed
 *
 *   executing → paused → executing (resumed)
 *
 * The worker processes ONE step per tick, then releases the task. This makes
 * execution visible to the user (steps appear one by one) and avoids
 * long-running transactions.
 */

import { db } from "@/lib/db";
import { processTask } from "./executor";
import { Prisma } from "@prisma/client";

const POLL_INTERVAL_MS = 2000; // 2 seconds
const STEP_DELAY_MS = 1000; // 1 second delay between steps (makes execution visible)

let running = false;

export async function startWorker(): Promise<void> {
  if (running) {
    console.log("[Worker] Already running");
    return;
  }
  running = true;
  console.log("[Worker] Starting AI Employee Runtime worker...");
  console.log(`[Worker] Poll interval: ${POLL_INTERVAL_MS}ms`);

  // Main loop
  while (running) {
    try {
      await pollOnce();
    } catch (err) {
      console.error("[Worker] Poll error:", err);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  console.log("[Worker] Stopped");
}

export function stopWorker(): void {
  running = false;
}

/**
 * One poll cycle: atomically claim a runnable task and process one step.
 *
 * Uses SELECT ... FOR UPDATE SKIP LOCKED to guarantee that even with
 * multiple worker processes running, each task is claimed by exactly
 * one worker. The row lock is released when the transaction commits
 * (after processTask returns).
 */
async function pollOnce(): Promise<void> {
  // ─── Stale step recovery ──────────────────────────────────────────────
  // Reset steps stuck in "running" for more than 5 minutes (worker crash recovery)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  await db.taskStep.updateMany({
    where: { status: "running", startedAt: { lt: fiveMinutesAgo } },
    data: { status: "pending" },
  });

  // ─── Approval expiration ──────────────────────────────────────────────
  // Fail tasks with expired pending approvals (timeoutAt < now)
  const expiredApprovals = await db.approval.findMany({
    where: { status: "pending", timeoutAt: { lt: new Date() } },
    select: { id: true, taskId: true, workspaceId: true },
  });
  for ( const ea of expiredApprovals) {
    await db.$transaction(async (tx) => {
      await tx.approval.updateMany({
        where: { id: ea.id, status: "pending" },
        data: { status: "expired", decidedAt: new Date(), decision: "expired" },
      });
      await tx.task.update({
        where: { id: ea.taskId },
        data: { status: "failed" },
      });
      await tx.taskStep.updateMany({
        where: { taskId: ea.taskId, status: "pending" },
        data: { status: "skipped", completedAt: new Date() },
      });
    });
    console.log(`[Worker] Expired approval ${ea.id} for task ${ea.taskId}`);
  }

  // ─── Task claiming ────────────────────────────────────────────────────
  let claimedTask: { id: string; title: string; status: string; employeeId: string } | null = null;

  try {
    claimedTask = await db.$transaction(async (tx) => {
      const result = await tx.$queryRaw<{ id: string; title: string; status: string; employeeId: string }[]>`
        SELECT "id", "title", "status", "employeeId"
        FROM "public"."Task"
        WHERE "status" IN ('queued', 'executing')
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      if (!result || result.length === 0) return null;
      return result[0];
    }, { timeout: 5000 });
  } catch (err) {
    console.error("[Worker] Claim error:", err);
    return;
  }

  if (!claimedTask) {
    return; // No work to do
  }

  // Check if the employee is active (not paused/retired)
  const employee = await db.employee.findUnique({
    where: { id: claimedTask.employeeId },
  });

  if (!employee) {
    await db.task.update({
      where: { id: claimedTask.id },
      data: { status: "failed" },
    });
    console.log(`[Worker] Task ${claimedTask.id} failed: employee not found`);
    return;
  }

  if (employee.status === "paused") {
    await db.task.update({
      where: { id: claimedTask.id },
      data: { status: "paused" },
    });
    console.log(`[Worker] Task ${claimedTask.id} paused (employee ${employee.name} is paused)`);
    return;
  }

  if (employee.status !== "active") {
    return;
  }

  // Process one step
  console.log(`[Worker] Processing task ${claimedTask.id} (${claimedTask.status}): "${claimedTask.title}"`);
  const result = await processTask(claimedTask.id);

  console.log(`[Worker] Task ${claimedTask.id}: ${result.action} — ${result.message}`);

  // Small delay to make execution visible and avoid hammering the DB
  if (result.action === "continue") {
    await sleep(STEP_DELAY_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

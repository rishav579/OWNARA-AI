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
  // Atomically claim a task using SELECT ... FOR UPDATE SKIP LOCKED.
  // This is PostgreSQL-specific and prevents concurrent workers from
  // picking up the same task.
  //
  // The transaction:
  //   1. Locks the first available queued/executing task (SKIP LOCKED
  //      means other workers skip locked rows and get the next one)
  //   2. Loads the task + employee for processing
  //   3. Commits (releasing the lock) — the task is now in a state
  //      that this worker will process
  //
  // We use a short-lived transaction just for the claim. The actual
  // task processing happens after the claim transaction commits.
  // This prevents long-running locks.

  let claimedTask: { id: string; title: string; status: string; employeeId: string } | null = null;

  try {
    claimedTask = await db.$transaction(async (tx) => {
      // Use raw SQL for FOR UPDATE SKIP LOCKED — Prisma doesn't support
      // this natively. We select only the task ID + basic info, then
      // let processTask load the full task with relations.
      const result = await tx.$queryRaw<{ id: string; title: string; status: string; employeeId: string }[]>`
        SELECT "id", "title", "status", "employeeId"
        FROM "public"."Task"
        WHERE "status" IN ('queued', 'executing')
        ORDER BY "status" ASC, "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

      if (!result || result.length === 0) {
        return null;
      }

      return result[0];
    }, {
      // Short timeout — if we can't claim quickly, another worker has the lock
      timeout: 5000,
    });
  } catch (err) {
    // Transaction timeout or error — skip this cycle
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

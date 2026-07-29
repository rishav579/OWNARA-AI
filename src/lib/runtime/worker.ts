/**
 * BIHARI AI — Worker Poll Loop
 *
 * Continuously polls for runnable tasks and processes them one step at a time.
 *
 * Per BED-001 §8: "The worker claims a task atomically via SELECT FOR UPDATE
 * SKIP LOCKED, executes idempotently, and releases on approval wait."
 *
 * Per BED-001 §8: "A single worker process with a small number of concurrent
 * job executors. Additional instances claim via SELECT FOR UPDATE SKIP LOCKED."
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
 * One poll cycle: find a runnable task and process one step.
 */
async function pollOnce(): Promise<void> {
  // Find a task that is queued or executing (has pending steps to process)
  const task = await db.task.findFirst({
    where: {
      status: { in: ["queued", "executing"] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }], // queued first, then oldest
  });

  if (!task) {
    return; // No work to do
  }

  // Check if the employee is active (not paused/retired)
  const employee = await db.employee.findUnique({
    where: { id: task.employeeId },
  });

  if (!employee) {
    // Employee doesn't exist — fail the task
    await db.task.update({
      where: { id: task.id },
      data: { status: "failed" },
    });
    console.log(`[Worker] Task ${task.id} failed: employee not found`);
    return;
  }

  if (employee.status === "paused") {
    // Employee is paused — pause the task
    await db.task.update({
      where: { id: task.id },
      data: { status: "paused" },
    });
    console.log(`[Worker] Task ${task.id} paused (employee ${employee.name} is paused)`);
    return;
  }

  if (employee.status !== "active") {
    // Employee is not active — skip
    return;
  }

  // Process one step
  console.log(`[Worker] Processing task ${task.id} (${task.status}): "${task.title}"`);
  const result = await processTask(task.id);

  console.log(`[Worker] Task ${task.id}: ${result.action} — ${result.message}`);

  // Small delay to make execution visible and avoid hammering the DB
  if (result.action === "continue") {
    await sleep(STEP_DELAY_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

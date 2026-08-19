/**
 * OWNARA — Worker Poll Loop
 *
 * Continuously polls for runnable tasks and processes them one step at a time.
 *
 * The worker claims a task atomically via the database concurrency layer
 * (src/lib/concurrency.ts). On PostgreSQL this uses SELECT ... FOR UPDATE
 * SKIP LOCKED; on SQLite it relies on the single-writer model. Either way,
 * multiple workers can never pick up the same task simultaneously.
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
import { claimNextTask } from "@/lib/concurrency";
import { superviseMandates } from "@/lib/mandate/supervisor";

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
 * Task claiming is delegated to the provider-portable concurrency layer
 * (claimNextTask), which guarantees that even with multiple worker
 * processes running on PostgreSQL, each task is claimed by exactly one
 * worker. The claim is released when the transaction commits.
 */
async function pollOnce(): Promise<void> {
  // ─── Mandate Supervisor ────────────────────────────────────────────────
  // The continuous-execution loop for active Mandates. Evaluates health and
  // spawns episodes (Tasks) when the desired state is not met. This is what
  // makes a Mandate ALIVE — it pursues its outcome 24/7, not just once.
  try {
    await superviseMandates();
  } catch (err) {
    console.error("[Worker] Mandate supervisor error:", err);
  }

  // ─── Stale step recovery ──────────────────────────────────────────────
  // Reset steps stuck in "running" for more than 5 minutes (worker crash recovery)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  await db.taskStep.updateMany({
    where: { status: "running", startedAt: { lt: fiveMinutesAgo } },
    data: { status: "pending" },
  });

  // ─── Interrupted Decided Approval Recovery ──────────────────────────────
  // Recover tasks that are in "waiting_approval" but whose approval has already been decided
  // (e.g. worker crashed during resumeAfterApproval).
  try {
    const interruptedApprovedTasks = await db.task.findMany({
      where: {
        status: "waiting_approval",
        approvals: {
          some: { status: "approved" },
        },
      },
      include: {
        approvals: {
          where: { status: "approved" },
          orderBy: { decidedAt: "desc" },
          take: 1,
        },
      },
      take: 5,
    });

    for (const it of interruptedApprovedTasks) {
      const app = it.approvals[0];
      if (app) {
        console.log(`[Worker] Recovering interrupted approved task ${it.id} (approval ${app.id})`);
        const { resumeAfterApproval } = await import("./executor");
        await resumeAfterApproval(it.id, app.id, app.decidedBy || "system", "Approver");
      }
    }

    const interruptedRejectedTasks = await db.task.findMany({
      where: {
        status: "waiting_approval",
        approvals: {
          some: { status: "rejected" },
        },
      },
      include: {
        approvals: {
          where: { status: "rejected" },
          orderBy: { decidedAt: "desc" },
          take: 1,
        },
      },
      take: 5,
    });

    for (const it of interruptedRejectedTasks) {
      const app = it.approvals[0];
      if (app) {
        console.log(`[Worker] Recovering interrupted rejected task ${it.id} (approval ${app.id})`);
        const { failAfterApprovalRejection } = await import("./executor");
        await failAfterApprovalRejection(it.id, app.id, app.decidedBy || "system", "Approver", app.reason || undefined);
      }
    }
  } catch (recErr) {
    console.error("[Worker] Interrupted approval recovery error:", recErr);
  }

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
  // Provider-portable atomic claim (see src/lib/concurrency.ts):
  //   • PostgreSQL → SELECT ... FOR UPDATE SKIP LOCKED
  //   • SQLite     → findFirst (single-writer model)
  let claimedTask: { id: string; title: string; status: string; employeeId: string } | null = null;

  try {
    claimedTask = await db.$transaction(async (tx) => {
      return await claimNextTask(tx);
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

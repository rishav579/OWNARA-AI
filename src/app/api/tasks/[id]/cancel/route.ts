import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";
import { appendAudit } from "@/lib/runtime/audit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const { id } = await params;
    const body = await parseBody<{ reason?: string }>(request).catch(() => ({}) as { reason?: string });

    const task = await db.task.findFirst({
      where: { id, workspaceId },
      include: { employee: true },
    });

    if (!task) return error("NOT_FOUND", "Task not found.", 404);

    if (["completed", "failed", "stopped"].includes(task.status)) {
      return error("CONFLICT", `Task is already ${task.status}.`, 409);
    }

    await db.$transaction(async (tx) => {
      // Mark any pending steps as skipped
      await tx.taskStep.updateMany({
        where: { taskId: id, status: "pending" },
        data: { status: "skipped", completedAt: new Date() },
      });

      // Transition task to stopped
      await tx.task.update({
        where: { id },
        data: { status: "stopped", completedAt: new Date() },
      });

      // Reset employee state to idle
      await tx.employee.update({
        where: { id: task.employeeId },
        data: { state: "idle" },
      });

      // Write audit entry
      await appendAudit(tx, {
        workspaceId,
        entryType: "task_stopped",
        actorType: "user",
        actorId: user.id,
        actorName: user.name,
        targetType: "task",
        targetId: id,
        payload: {
          title: task.title,
          employee: task.employee.name,
          reason: body.reason || "Cancelled by user",
        },
      });
    });

    return success({
      id,
      status: "stopped",
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

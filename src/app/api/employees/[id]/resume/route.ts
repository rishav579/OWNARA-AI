import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { appendAudit } from "@/lib/runtime/audit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const employee = await db.employee.findFirst({ where: { id, workspaceId } });
    if (!employee) return error("NOT_FOUND", "Employee not found.", 404);
    if (employee.status !== "paused") return error("CONFLICT", "Only paused employees can be resumed.", 409);

    // Resume the employee and any paused task
    await db.$transaction(async (tx) => {
      const restoredState = employee.priorState || "idle";

      await tx.employee.update({
        where: { id },
        data: { status: "active", state: restoredState, priorState: null },
      });

      // Resume any paused task — set it back to "executing" so the worker picks it up
      const pausedTask = await tx.task.findFirst({
        where: {
          employeeId: id,
          status: "paused",
        },
      });

      if (pausedTask) {
        await tx.task.update({
          where: { id: pausedTask.id },
          data: { status: "executing" },
        });

        await appendAudit(tx, {
          workspaceId,
          entryType: "task_resumed",
          actorType: "user",
          actorId: user.id,
          actorName: user.name,
          targetType: "task",
          targetId: pausedTask.id,
          payload: {
            employee: employee.name,
            task: pausedTask.title,
          },
        });
      }

      await appendAudit(tx, {
        workspaceId,
        entryType: "employee_resumed",
        actorType: "user",
        actorId: user.id,
        actorName: user.name,
        targetType: "employee",
        targetId: id,
        payload: {
          employee: employee.name,
          prior_state: restoredState,
        },
      });
    });

    return success({ id, status: "active", state: employee.priorState || "idle", priorState: null });
  } catch (err) {
    return handleApiError(err);
  }
}

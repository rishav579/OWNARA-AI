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
    if (employee.status !== "active") return error("CONFLICT", "Only active employees can be paused.", 409);

    // Pause the employee and any in-flight task
    await db.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: { status: "paused", priorState: employee.state, state: "paused" },
      });

      // Pause any in-flight task
      const inFlightTask = await tx.task.findFirst({
        where: {
          employeeId: id,
          status: { in: ["queued", "planning", "executing"] },
        },
      });

      if (inFlightTask) {
        await tx.task.update({
          where: { id: inFlightTask.id },
          data: { status: "paused" },
        });

        await appendAudit(tx, {
          workspaceId,
          entryType: "task_paused",
          actorType: "user",
          actorId: user.id,
          actorName: user.name,
          targetType: "task",
          targetId: inFlightTask.id,
          payload: {
            employee: employee.name,
            task: inFlightTask.title,
          },
        });
      }

      await appendAudit(tx, {
        workspaceId,
        entryType: "employee_paused",
        actorType: "user",
        actorId: user.id,
        actorName: user.name,
        targetType: "employee",
        targetId: id,
        payload: {
          employee: employee.name,
        },
      });
    });

    return success({ id, status: "paused", state: "paused", priorState: employee.state });
  } catch (err) {
    return handleApiError(err);
  }
}

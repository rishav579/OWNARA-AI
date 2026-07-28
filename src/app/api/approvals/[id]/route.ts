import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const a = await db.approval.findFirst({
      where: { id, workspaceId },
      include: { employee: true, task: true },
    });

    if (!a) return error("NOT_FOUND", "Approval not found.", 404);

    return success({
      id: a.id,
      taskId: a.taskId,
      taskTitle: a.task.title,
      employeeId: a.employeeId,
      employeeName: a.employee.name,
      tool: a.tool,
      toolDisplayName: a.toolDisplayName,
      proposedAction: JSON.parse(a.proposedAction),
      status: a.status,
      criticality: a.criticality,
      createdAt: a.createdAt,
      timeoutAt: a.timeoutAt,
      decidedBy: a.decidedBy,
      decidedAt: a.decidedAt,
      decision: a.decision,
      reason: a.reason,
      modifiedAction: a.modifiedAction ? JSON.parse(a.modifiedAction) : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

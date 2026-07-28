import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);

    const approvals = await db.approval.findMany({
      where: { workspaceId, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: { employee: true, task: true },
    });

    const data = approvals.map((a) => ({
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
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

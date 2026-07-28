import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "pending";
    const employeeId = url.searchParams.get("employeeId");

    const where: any = { workspaceId };
    if (status !== "all") where.status = status;
    if (employeeId) where.employeeId = employeeId;

    const approvals = await db.approval.findMany({
      where,
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
      decidedBy: a.decidedBy,
      decidedAt: a.decidedAt,
      decision: a.decision,
      reason: a.reason,
      modifiedAction: a.modifiedAction ? JSON.parse(a.modifiedAction) : null,
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

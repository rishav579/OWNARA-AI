import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";
import { AVATAR_COLORS } from "@/lib/shared-helpers";

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
      employeeColor: AVATAR_COLORS[a.employee.name] || "#10b981",
      tool: a.tool,
      toolDisplayName: a.toolDisplayName,
      proposedAction: JSON.parse(a.proposedAction),
      originalAction: a.originalAction ? JSON.parse(a.originalAction) : null,
      status: a.status,
      criticality: a.criticality,
      riskScore: a.riskScore,
      confidence: a.confidence,
      businessImpact: a.businessImpact,
      policyTrigger: a.policyTrigger,
      policyId: a.policyId,
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


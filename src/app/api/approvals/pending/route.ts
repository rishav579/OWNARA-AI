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
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

const AVATAR_COLORS: Record<string, string> = {
  Saanvi: "#10b981",
  Arjun: "#f59e0b",
  Meera: "#8b5cf6",
  Vikram: "#ec4899",
  Priya: "#64748b",
};

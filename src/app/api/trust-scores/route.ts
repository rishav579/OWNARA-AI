import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";
import { AVATAR_COLORS } from "@/lib/shared-helpers";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId");

    const where: any = { workspaceId };
    if (employeeId) where.employeeId = employeeId;

    const scores = await db.trustScore.findMany({
      where,
      include: { employee: true },
      orderBy: { overallScore: "desc" },
    });

    const data = scores.map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      employeeName: s.employee.name,
      employeeRole: s.employee.role,
      avatarColor: AVATAR_COLORS[s.employee.name] || "#10b981",
      successRate: s.successRate,
      approvalRate: s.approvalRate,
      humanCorrections: s.humanCorrections,
      policyViolations: s.policyViolations,
      tasksCompleted: s.tasksCompleted,
      moneyRecoveredCents: s.moneyRecoveredCents,
      accuracyScore: s.accuracyScore,
      overallScore: s.overallScore,
      trend: s.trend,
      trendDelta: s.trendDelta,
      computedAt: s.computedAt,
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}


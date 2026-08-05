import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { AVATAR_COLORS, ROLE_LABELS } from "@/lib/shared-helpers";



// Structural type matching the Employee fields used by serialize.
// Works for both findFirst (with includes) and update results.
type EmployeeRow = {
  id: string;
  name: string;
  role: string;
  templateId: string | null;
  status: string;
  state: string;
  createdAt: Date;
  activatedAt: Date | null;
  retiredAt: Date | null;
  taskCount: number;
  completedTasks: number;
  tokenUsage: number;
  tokenCap: number;
  tools: string;
  pendingApprovals: number;
  jobDescription: string;
  boundaries: string;
  approvalRules: string;
};

function serialize(e: EmployeeRow) {
  return {
    id: e.id,
    name: e.name,
    role: e.role,
    roleName: ROLE_LABELS[e.role as keyof typeof ROLE_LABELS] || e.role,
    templateId: e.templateId,
    status: e.status,
    state: e.state,
    avatarColor: AVATAR_COLORS[e.name] || "#10b981",
    createdAt: e.createdAt,
    activatedAt: e.activatedAt,
    retiredAt: e.retiredAt,
    taskCount: e.taskCount,
    completedTasks: e.completedTasks,
    tokenUsage: e.tokenUsage,
    tokenCap: e.tokenCap,
    tools: JSON.parse(e.tools) as string[],
    pendingApprovals: e.pendingApprovals,
    jobDescription: e.jobDescription,
    boundaries: JSON.parse(e.boundaries) as string[],
    approvalRules: JSON.parse(e.approvalRules) as Record<string, string>,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const employee = await db.employee.findFirst({
      where: { id, workspaceId },
      include: {
        tasks: { orderBy: { createdAt: "desc" }, take: 20 },
        documents: true,
        toolPermissions: { include: { tool: true } },
      },
    });

    if (!employee) {
      return error("NOT_FOUND", "Employee not found.", 404);
    }

    // Fetch trust score
    const trustScore = await db.trustScore.findFirst({
      where: { workspaceId, employeeId: id },
      orderBy: { computedAt: "desc" },
    });

    const base = serialize(employee);
    return success({
      ...base,
      trustScore: trustScore ? {
        overallScore: trustScore.overallScore,
        trend: trustScore.trend,
        trendDelta: trustScore.trendDelta,
        successRate: trustScore.successRate,
        approvalRate: trustScore.approvalRate,
        humanCorrections: trustScore.humanCorrections,
        policyViolations: trustScore.policyViolations,
        accuracyScore: trustScore.accuracyScore,
        moneyRecoveredCents: trustScore.moneyRecoveredCents,
      } : null,
      tasks: employee.tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        stepCount: t.stepCount,
        stepCap: t.stepCap,
        tokenUsage: t.tokenUsage,
        tokenCap: t.tokenCap,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
      })),
      documents: employee.documents.map((d: any) => ({
        id: d.id,
        filename: d.filename,
        status: d.status,
        chunkCount: d.chunkCount,
        createdAt: d.createdAt,
      })),
      toolPermissions: employee.toolPermissions.map((p: any) => ({
        id: p.id,
        toolId: p.toolId,
        toolName: p.tool.name,
        displayName: p.tool.displayName,
        criticalityOverride: p.criticalityOverride,
        grantedAt: p.grantedAt,
        revokedAt: p.revokedAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;
    const body = await request.json();

    const employee = await db.employee.findFirst({ where: { id, workspaceId } });
    if (!employee) {
      return error("NOT_FOUND", "Employee not found.", 404);
    }
    if (employee.status === "retired") {
      return error("CONFLICT", "Cannot update a retired employee.", 409);
    }

    const updated = await db.employee.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.jobDescription ? { jobDescription: body.jobDescription } : {}),
        ...(body.operatingBoundaries ? { boundaries: JSON.stringify(body.operatingBoundaries) } : {}),
        ...(body.approvalRules ? { approvalRules: JSON.stringify(body.approvalRules) } : {}),
        ...(body.tokenCap ? { tokenCap: body.tokenCap } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
    });

    return success(serialize(updated));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const employee = await db.employee.findFirst({ where: { id, workspaceId } });
    if (!employee) {
      return error("NOT_FOUND", "Employee not found.", 404);
    }

    const updated = await db.employee.update({
      where: { id },
      data: { status: "retired", retiredAt: new Date(), state: "idle" },
    });

    return success({ id: updated.id, status: updated.status, retiredAt: updated.retiredAt });
  } catch (err) {
    return handleApiError(err);
  }
}

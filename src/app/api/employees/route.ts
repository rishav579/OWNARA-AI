import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const role = url.searchParams.get("role");
    const q = url.searchParams.get("q");

    const employees = await db.employee.findMany({
      where: {
        workspaceId,
        ...(status && status !== "all" ? { status } : {}),
        ...(role ? { role } : {}),
        ...(q ? { name: { contains: q } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const data = employees.map((e) => ({
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
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const body = await request.json();
    const { name, templateId, jobDescription, operatingBoundaries, approvalRules, toolNames } = body;

    const template = templateId ? await db.employeeTemplate.findUnique({ where: { id: templateId } }) : null;
    if (templateId && !template) {
      return error("NOT_FOUND", "Template not found.", 404);
    }

    const employee = await db.employee.create({
      data: {
        workspaceId,
        name,
        role: template?.role || "customer_support_agent",
        templateId: template?.id || null,
        status: "active",
        state: "idle",
        jobDescription: jobDescription || template?.defaultJobDescription || "",
        boundaries: JSON.stringify(operatingBoundaries || []),
        approvalRules: JSON.stringify(approvalRules || JSON.parse(template?.defaultApprovalRules || "{}")),
        tools: JSON.stringify(toolNames || JSON.parse(template?.defaultToolNames || "[]")),
        tokenCap: 5000000,
        createdBy: user.id,
        activatedAt: new Date(),
      },
    });

    // Audit
    await appendAudit(workspaceId, {
      entryType: "employee_created",
      actorType: "user",
      actorId: user.id,
      actorName: user.name,
      targetType: "employee",
      targetId: employee.id,
      payload: { employee: name, role: employee.role },
    });

    return success(employee, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

// Helper to append audit (hash-chained)
async function appendAudit(workspaceId: string, entry: {
  entryType: string;
  actorType: string;
  actorId: string | null;
  actorName: string;
  targetType: string;
  targetId: string;
  payload: Record<string, string>;
}) {
  const crypto = await import("crypto");
  const last = await db.auditLog.findFirst({
    where: { workspaceId },
    orderBy: { sequenceNumber: "desc" },
  });
  const seq = (last?.sequenceNumber || 0) + 1;
  const canonical = JSON.stringify({
    workspaceId, sequenceNumber: seq, entryType: entry.entryType,
    actorType: entry.actorType, actorName: entry.actorName,
    targetType: entry.targetType, targetId: entry.targetId,
    payload: entry.payload, createdAt: new Date().toISOString(),
  });
  const entryHash = crypto.createHash("sha256").update((last?.entryHash || "") + canonical).digest("hex");
  await db.auditLog.create({
    data: {
      workspaceId, sequenceNumber: seq,
      entryType: entry.entryType, actorType: entry.actorType,
      actorId: entry.actorId, actorName: entry.actorName,
      targetType: entry.targetType, targetId: entry.targetId,
      payload: JSON.stringify(entry.payload),
      previousHash: last?.entryHash || null,
      entryHash,
    },
  });
}

const ROLE_LABELS = {
  customer_support_agent: "Customer Support Agent",
  sales_development_representative: "Sales Development Rep",
  research_analyst: "Research Analyst",
};

const AVATAR_COLORS: Record<string, string> = {
  Saanvi: "#10b981",
  Arjun: "#f59e0b",
  Meera: "#8b5cf6",
  Vikram: "#ec4899",
  Priya: "#64748b",
};

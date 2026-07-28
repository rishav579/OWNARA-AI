import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

const EMPLOYEE_NAMES: Record<string, string> = {};

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const employeeId = url.searchParams.get("employeeId");

    const where: any = { workspaceId };
    if (status === "executing") {
      where.status = { in: ["assigned", "planning", "executing"] };
    } else if (status && status !== "all") {
      where.status = status;
    }
    if (employeeId) where.employeeId = employeeId;

    const tasks = await db.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { employee: true },
    });

    const data = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      employeeId: t.employeeId,
      employeeName: t.employee.name,
      employeeColor: AVATAR_COLORS[t.employee.name] || "#10b981",
      status: t.status,
      priority: t.priority,
      stepCount: t.stepCount,
      stepCap: t.stepCap,
      tokenUsage: t.tokenUsage,
      tokenCap: t.tokenCap,
      assignedBy: t.assignedBy,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
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
    const { title, description, employeeId, stepCap, tokenCap } = body;

    const employee = await db.employee.findFirst({ where: { id: employeeId, workspaceId } });
    if (!employee) return error("NOT_FOUND", "Employee not found.", 404);
    if (employee.status !== "active") return error("CONFLICT", "Employee is not active.", 409);

    const task = await db.task.create({
      data: {
        workspaceId,
        employeeId,
        assignedBy: user.id,
        title,
        description,
        status: "assigned",
        priority: body.priority || "medium",
        stepCap: stepCap || 20,
        tokenCap: tokenCap || 100000,
        startedAt: new Date(),
      },
    });

    await db.employee.update({
      where: { id: employeeId },
      data: { taskCount: { increment: 1 } },
    });

    return success({
      id: task.id,
      title: task.title,
      status: task.status,
      stepCount: task.stepCount,
      stepCap: task.stepCap,
      tokenUsage: task.tokenUsage,
      tokenCap: task.tokenCap,
      createdAt: task.createdAt,
    }, 201);
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
void EMPLOYEE_NAMES;

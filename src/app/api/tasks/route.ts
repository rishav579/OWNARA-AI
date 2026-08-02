import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { appendAudit } from "@/lib/runtime/audit";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const employeeId = url.searchParams.get("employeeId");

    const where: any = { workspaceId };
    if (status === "executing") {
      where.status = { in: ["queued", "planning", "executing"] };
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

    // Check the employee doesn't already have an in-flight task
    const inFlight = await db.task.findFirst({
      where: {
        employeeId,
        status: { in: ["queued", "planning", "executing", "waiting_approval"] },
      },
    });
    if (inFlight) {
      return error("CONFLICT", "Employee already has an active task. Wait for it to complete or cancel it first.", 409);
    }

    // Create the task with status "queued" — the worker will pick it up
    const task = await db.$transaction(async (tx) => {
      const newTask = await tx.task.create({
        data: {
          workspaceId,
          employeeId,
          assignedBy: user.id,
          title,
          description,
          status: "queued", // Worker picks up queued tasks
          priority: body.priority || "medium",
          stepCap: stepCap || 20,
          tokenCap: tokenCap || 100000,
          startedAt: new Date(),
        },
      });

      // Update employee state to "assigned"
      await tx.employee.update({
        where: { id: employeeId },
        data: { state: "assigned", taskCount: { increment: 1 } },
      });

      // Write audit entry for task creation
      await appendAudit(tx, {
        workspaceId,
        entryType: "task_created",
        actorType: "user",
        actorId: user.id,
        actorName: user.name,
        targetType: "task",
        targetId: newTask.id,
        payload: {
          title,
          employee: employee.name,
          role: employee.role,
        },
      });

      return newTask;
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


import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const task = await db.task.findFirst({
      where: { id, workspaceId },
      include: { employee: true, steps: { orderBy: { stepNumber: "asc" } } },
    });

    if (!task) return error("NOT_FOUND", "Task not found.", 404);

    return success({
      id: task.id,
      title: task.title,
      description: task.description,
      employeeId: task.employeeId,
      employeeName: task.employee.name,
      status: task.status,
      priority: task.priority,
      stepCount: task.stepCount,
      stepCap: task.stepCap,
      tokenUsage: task.tokenUsage,
      tokenCap: task.tokenCap,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      steps: task.steps.map((s) => ({
        stepNumber: s.stepNumber,
        stepType: s.stepType,
        input: JSON.parse(s.input),
        reasoning: s.reasoning,
        output: s.output ? JSON.parse(s.output) : null,
        status: s.status,
        tokens: s.tokens,
        durationMs: s.durationMs,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const task = await db.task.findFirst({ where: { id, workspaceId } });
    if (!task) return error("NOT_FOUND", "Task not found.", 404);

    const steps = await db.taskStep.findMany({
      where: { taskId: id },
      orderBy: { stepNumber: "asc" },
    });

    return success(steps.map((s) => ({
      stepNumber: s.stepNumber,
      stepType: s.stepType,
      input: JSON.parse(s.input),
      reasoning: s.reasoning,
      output: s.output ? JSON.parse(s.output) : null,
      status: s.status,
      tokens: s.tokens,
      durationMs: s.durationMs,
      policyRefs: s.policyRefs ? JSON.parse(s.policyRefs) : null,
      knowledgeRefs: s.knowledgeRefs ? JSON.parse(s.knowledgeRefs) : null,
      confidence: s.confidence,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    })));
  } catch (err) {
    return handleApiError(err);
  }
}

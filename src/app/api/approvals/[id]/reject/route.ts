import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";
import { failAfterApprovalRejection } from "@/lib/runtime/executor";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const { id } = await params;
    const body = await parseBody<{ reason?: string }>(request);

    const approval = await db.approval.findFirst({ where: { id, workspaceId } });
    if (!approval) return error("NOT_FOUND", "Approval not found.", 404);
    if (approval.status !== "pending") return error("CONFLICT", "Approval is not pending.", 409);

    // Update the approval record
    await db.approval.update({
      where: { id },
      data: {
        status: "rejected",
        decidedBy: user.id,
        decidedAt: new Date(),
        decision: "rejected",
        reason: body.reason || null,
      },
    });

    // Fail the task — this marks the approval_gate step as failed,
    // transitions the task to "failed", and writes audit entries.
    await failAfterApprovalRejection(
      approval.taskId,
      id,
      user.id,
      user.name,
      body.reason
    );

    return success({
      id,
      status: "rejected",
      decision: {
        decision: "rejected",
        decidedBy: user.id,
        decidedByName: user.name,
        reason: body.reason || null,
        decidedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

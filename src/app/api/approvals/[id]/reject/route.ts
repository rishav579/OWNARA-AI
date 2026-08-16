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

    // ─── Atomic claim (concurrency guard) ────────────────────────────────
    // updateMany with status: "pending" ensures only ONE concurrent reject
    // call proceeds to failAfterApprovalRejection. A simultaneous second
    // call (e.g. two managers) gets count === 0 and returns 409.
    const claimed = await db.approval.updateMany({
      where: { id, workspaceId, status: "pending" },
      data: {
        status: "rejected",
        decidedBy: user.id,
        decidedAt: new Date(),
        decision: "rejected",
        reason: body.reason || null,
      },
    });

    if (claimed.count === 0) {
      return error("CONFLICT", "Approval was already decided by another user.", 409);
    }

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

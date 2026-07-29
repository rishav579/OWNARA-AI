import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const { id } = await params;
    const body = await parseBody<{ reason?: string }>(request);

    const approval = await db.approval.findFirst({ where: { id, workspaceId } });
    if (!approval) return error("NOT_FOUND", "Approval not found.", 404);
    if (approval.status !== "pending") return error("CONFLICT", "Approval is not pending.", 409);

    const updated = await db.approval.update({
      where: { id },
      data: {
        status: "approved",
        decidedBy: user.id,
        decidedAt: new Date(),
        decision: "approved",
        reason: body.reason || null,
      },
    });

    return success({
      id: updated.id,
      status: updated.status,
      decision: {
        decision: "approved",
        decidedBy: user.id,
        decidedByName: user.name,
        reason: updated.reason,
        decidedAt: updated.decidedAt,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

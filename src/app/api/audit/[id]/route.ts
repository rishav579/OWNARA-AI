import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const entry = await db.auditLog.findFirst({ where: { id, workspaceId } });
    if (!entry) return error("NOT_FOUND", "Audit entry not found.", 404);

    return success({
      id: entry.id,
      sequenceNumber: entry.sequenceNumber,
      entryType: entry.entryType,
      actorType: entry.actorType,
      actorId: entry.actorId,
      actorName: entry.actorName,
      targetType: entry.targetType,
      targetId: entry.targetId,
      payload: JSON.parse(entry.payload),
      previousHash: entry.previousHash,
      entryHash: entry.entryHash,
      createdAt: entry.createdAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

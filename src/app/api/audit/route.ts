import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const entryType = url.searchParams.get("entryType");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const where: any = { workspaceId };
    if (entryType) where.entryType = entryType;

    const entries = await db.auditLog.findMany({
      where,
      orderBy: { sequenceNumber: "desc" },
      take: limit,
    });

    const data = entries.map((e) => ({
      id: e.id,
      sequenceNumber: e.sequenceNumber,
      entryType: e.entryType,
      actorType: e.actorType,
      actorId: e.actorId,
      actorName: e.actorName,
      targetType: e.targetType,
      targetId: e.targetId,
      payload: JSON.parse(e.payload),
      previousHash: e.previousHash,
      entryHash: e.entryHash,
      createdAt: e.createdAt,
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

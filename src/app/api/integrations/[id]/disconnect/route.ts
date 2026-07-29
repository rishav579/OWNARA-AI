import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const integration = await db.integration.findFirst({ where: { id, workspaceId } });
    if (!integration) return error("NOT_FOUND", "Integration not found.", 404);

    const updated = await db.integration.update({
      where: { id },
      data: { status: "available", connectedAt: null, connectedBy: null },
    });

    return success({ id: updated.id, provider: updated.provider, status: updated.status });
  } catch (err) {
    return handleApiError(err);
  }
}

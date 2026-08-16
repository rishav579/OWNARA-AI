import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const doc = await db.knowledgeDocument.findFirst({ where: { id, workspaceId } });
    if (!doc) return error("NOT_FOUND", "Document not found.", 404);

    return success({
      id: doc.id,
      status: doc.status,
      chunkCount: doc.chunkCount,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const doc = await db.knowledgeDocument.findFirst({ where: { id, workspaceId } });
    if (!doc) return error("NOT_FOUND", "Document not found.", 404);

    const updated = await db.knowledgeDocument.update({
      where: { id },
      data: { status: "removed", removedAt: new Date() },
    });

    return success({ id: updated.id, status: updated.status, removedAt: updated.removedAt });
  } catch (err) {
    return handleApiError(err);
  }
}

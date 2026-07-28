import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const notif = await db.notification.findFirst({ where: { id, workspaceId, userId: user.id } });
    if (!notif) return error("NOT_FOUND", "Notification not found.", 404);

    const updated = await db.notification.update({
      where: { id },
      data: { status: "read", readAt: new Date() },
    });

    return success({ id: updated.id, status: updated.status, readAt: updated.readAt });
  } catch (err) {
    return handleApiError(err);
  }
}

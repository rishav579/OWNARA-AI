import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);

    const notifications = await db.notification.findMany({
      where: { workspaceId, userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const data = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      referenceType: n.referenceType,
      referenceId: n.referenceId,
      read: n.status === "read",
      createdAt: n.createdAt,
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

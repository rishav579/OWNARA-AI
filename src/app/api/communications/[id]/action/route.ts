import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";
import {
  markAsRead,
  acknowledgeCommunication,
  resolveCommunication,
  escalateCommunication,
} from "@/lib/communication/engine";

/**
 * COMM-001 — Communication Action API
 *
 * POST /api/communications/[id]/action
 *
 * Performs an action on a communication:
 *   - read: mark as read
 *   - acknowledge: receiver confirms they've seen it
 *   - resolve: the issue is handled
 *   - escalate: raise priority + notify higher authority
 *   - ignore: receiver dismisses the message
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const { id } = await params;
    const body = await parseBody<{ action: string; note?: string; reason?: string }>(request);

    // Verify the communication belongs to this workspace
    const comm = await db.employeeCommunication.findFirst({ where: { id, workspaceId } });
    if (!comm) return error("NOT_FOUND", "Communication not found.", 404);

    switch (body.action) {
      case "read":
        await markAsRead(id);
        return success({ id, status: "read" });

      case "acknowledge":
        await acknowledgeCommunication(id, user.id, user.name);
        return success({ id, status: "acknowledged" });

      case "resolve":
        await resolveCommunication(id, user.id, user.name, body.note);
        return success({ id, status: "resolved" });

      case "escalate":
        await escalateCommunication(id, user.id, user.name, body.reason || "Escalated by user");
        return success({ id, status: "escalated" });

      case "ignore":
        await db.employeeCommunication.update({
          where: { id },
          data: { status: "ignored", responseAction: "ignore" },
        });
        return success({ id, status: "ignored" });

      default:
        return error("VALIDATION_ERROR", `Unknown action: ${body.action}`, 400);
    }
  } catch (err) {
    return handleApiError(err);
  }
}

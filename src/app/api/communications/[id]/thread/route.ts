import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { getThreadMessages, replyToCommunication } from "@/lib/communication/engine";

/**
 * COMM-001 — Communication Thread API
 *
 * GET /api/communications/[id]/thread — get all messages in the thread
 * POST /api/communications/[id]/thread — reply to the communication
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    // Find the communication to get its threadId
    const comm = await db.employeeCommunication.findFirst({ where: { id, workspaceId } });
    if (!comm) return error("NOT_FOUND", "Communication not found.", 404);

    if (!comm.threadId) {
      // No thread — just return this one message
      return success([{
        ...comm,
        evidence: JSON.parse(comm.evidence),
        attachments: JSON.parse(comm.attachments),
        actionButtons: JSON.parse(comm.actionButtons),
      }]);
    }

    const messages = await getThreadMessages(comm.threadId);
    const data = messages.map((m) => ({
      ...m,
      evidence: JSON.parse(m.evidence),
      attachments: JSON.parse(m.attachments),
      actionButtons: JSON.parse(m.actionButtons),
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const { id } = await params;
    const body = await request.json();

    const result = await replyToCommunication(id, {
      workspaceId,
      senderUserId: user.id,
      senderName: user.name,
      senderType: "user",
      receiverType: body.receiverType || "employee",
      receiverEmployeeId: body.receiverEmployeeId,
      receiverUserId: body.receiverUserId,
      receiverName: body.receiverName || "",
      communicationType: body.communicationType || "status_update",
      priority: body.priority || "medium",
      subject: body.subject,
      summary: body.summary || "",
      explanation: body.explanation || "",
      relatedTaskId: body.relatedTaskId,
      relatedCustomerId: body.relatedCustomerId,
      relatedInvoiceId: body.relatedInvoiceId,
      whyExists: body.whyExists || "Reply from user",
      evidence: body.evidence,
      confidence: body.confidence,
      businessImpact: body.businessImpact || "",
      recommendedAction: body.recommendedAction || "",
      expectedOutcome: body.expectedOutcome || "",
      attachments: body.attachments,
      actionButtons: body.actionButtons,
    });

    return success(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

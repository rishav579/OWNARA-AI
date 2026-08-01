import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { listCommunications, createCommunication, type CommunicationQuery } from "@/lib/communication/engine";

/**
 * COMM-001 — Communications List + Create API
 *
 * GET /api/communications — list communications with filters
 * POST /api/communications — create a new communication
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);

    const query: CommunicationQuery = {
      status: (url.searchParams.get("status") as any) || "all",
      priority: (url.searchParams.get("priority") as any) || "all",
      communicationType: (url.searchParams.get("communicationType") as any) || "all",
      receiverType: (url.searchParams.get("receiverType") as any) || "all",
      employeeId: url.searchParams.get("employeeId") || undefined,
      customerId: url.searchParams.get("customerId") || undefined,
      taskId: url.searchParams.get("taskId") || undefined,
      invoiceId: url.searchParams.get("invoiceId") || undefined,
      search: url.searchParams.get("search") || undefined,
      limit: parseInt(url.searchParams.get("limit") || "50", 10),
    };

    const communications = await listCommunications(workspaceId, query);

    // Parse JSON fields for the response
    const data = communications.map((c) => ({
      ...c,
      evidence: JSON.parse(c.evidence),
      attachments: JSON.parse(c.attachments),
      actionButtons: JSON.parse(c.actionButtons),
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const body = await request.json();

    const result = await createCommunication({
      workspaceId,
      senderUserId: user.id,
      senderName: user.name,
      senderType: "user",
      receiverType: body.receiverType || "all_humans",
      receiverEmployeeId: body.receiverEmployeeId,
      receiverUserId: body.receiverUserId,
      receiverName: body.receiverName || "Team",
      communicationType: body.communicationType || "notification",
      priority: body.priority || "medium",
      subject: body.subject,
      summary: body.summary || "",
      explanation: body.explanation || "",
      relatedTaskId: body.relatedTaskId,
      relatedContractId: body.relatedContractId,
      relatedCustomerId: body.relatedCustomerId,
      relatedInvoiceId: body.relatedInvoiceId,
      relatedApprovalId: body.relatedApprovalId,
      relatedReminderId: body.relatedReminderId,
      whyExists: body.whyExists || "Manual communication from user",
      evidence: body.evidence,
      confidence: body.confidence,
      businessImpact: body.businessImpact || "",
      recommendedAction: body.recommendedAction || "",
      expectedOutcome: body.expectedOutcome || "",
      attachments: body.attachments,
      actionButtons: body.actionButtons,
      threadId: body.threadId,
      parentCommunicationId: body.parentCommunicationId,
    });

    return success(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

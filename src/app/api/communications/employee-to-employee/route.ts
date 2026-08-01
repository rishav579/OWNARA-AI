import { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";
import { sendEmployeeCoordination, type CommunicationType, type Priority } from "@/lib/communication/engine";

/**
 * COMM-001 — Employee-to-Employee Coordination API
 *
 * POST /api/communications/employee-to-employee
 *
 * Sends a coordination message from one AI Employee to another.
 * This enables employee-to-employee handoffs.
 *
 * Example:
 *   Finance Employee → Back Office Employee
 *   "Invoice requires missing GST document."
 *
 *   Back Office → Finance (reply via thread)
 *   "Document uploaded."
 *   → Finance resumes automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const body = await parseBody<{
      fromEmployeeId: string;
      toEmployeeId: string;
      subject: string;
      summary: string;
      explanation: string;
      communicationType: CommunicationType;
      priority?: Priority;
      relatedTaskId?: string;
      relatedInvoiceId?: string;
      relatedCustomerId?: string;
      whyExists: string;
      businessImpact: string;
      recommendedAction: string;
      expectedOutcome: string;
      evidence?: Array<{ source: string; fact: string; weight: string }>;
      confidence?: number;
    }>(request);

    if (!body.fromEmployeeId || !body.toEmployeeId) {
      return error("VALIDATION_ERROR", "fromEmployeeId and toEmployeeId are required.", 400);
    }

    const result = await sendEmployeeCoordination(
      body.fromEmployeeId,
      body.toEmployeeId,
      workspaceId,
      {
        subject: body.subject,
        summary: body.summary,
        explanation: body.explanation,
        communicationType: body.communicationType,
        priority: body.priority,
        relatedTaskId: body.relatedTaskId,
        relatedInvoiceId: body.relatedInvoiceId,
        relatedCustomerId: body.relatedCustomerId,
        whyExists: body.whyExists,
        businessImpact: body.businessImpact,
        recommendedAction: body.recommendedAction,
        expectedOutcome: body.expectedOutcome,
        evidence: body.evidence,
        confidence: body.confidence,
      }
    );

    return success(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

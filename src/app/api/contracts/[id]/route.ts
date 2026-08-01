import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

/**
 * GET /api/contracts/:id
 * Returns a single execution contract with all fields.
 * Used by the Decision Center to display the full contract detail.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const contract = await db.executionContract.findFirst({
      where: { id, workspaceId },
    });

    if (!contract) return error("NOT_FOUND", "Contract not found.", 404);

    return success({
      id: contract.id,
      contractNumber: contract.contractNumber,
      version: contract.version,
      parentContractId: contract.parentContractId,
      status: contract.status,
      taskId: contract.taskId,
      employeeId: contract.employeeId,
      approvalId: contract.approvalId,
      goal: contract.goal,
      proposedAction: JSON.parse(contract.proposedAction),
      confidence: contract.confidence,
      evidence: JSON.parse(contract.evidence),
      memoriesUsed: JSON.parse(contract.memoriesUsed),
      policiesUsed: JSON.parse(contract.policiesUsed),
      businessImpact: contract.businessImpact,
      affectedSystems: JSON.parse(contract.affectedSystems),
      rollbackPlan: contract.rollbackPlan,
      estimatedBusinessOutcome: contract.estimatedBusinessOutcome,
      estimatedTokenCost: contract.estimatedTokenCost,
      estimatedExecutionTime: contract.estimatedExecutionTime,
      requiredAuthority: contract.requiredAuthority,
      contractHash: contract.contractHash,
      generatedAt: contract.generatedAt,
      approvedAt: contract.approvedAt,
      approvedBy: contract.approvedBy,
      rejectedAt: contract.rejectedAt,
      rejectedBy: contract.rejectedBy,
      rejectionReason: contract.rejectionReason,
      supersededAt: contract.supersededAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

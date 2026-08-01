import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);

    const approvals = await db.approval.findMany({
      where: { workspaceId, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: { employee: true, task: true },
    });

    // For each approval, find the contract from the task's approval_gate step output
    const data = await Promise.all(approvals.map(async (a) => {
      // Find the approval_gate step for this task that has contract data in its output
      const gateStep = await db.taskStep.findFirst({
        where: {
          taskId: a.taskId,
          stepType: "approval_gate",
          status: "pending",
          output: { not: undefined },
        },
      });

      let contractData: any = null;
      if (gateStep?.output) {
        try {
          const output = JSON.parse(gateStep.output);
          if (output.contractId) {
            const contract = await db.executionContract.findUnique({
              where: { id: output.contractId },
            });
            if (contract) {
              contractData = {
                id: contract.id,
                contractNumber: contract.contractNumber,
                version: contract.version,
                status: contract.status,
                goal: contract.goal,
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
                parentContractId: contract.parentContractId,
              };
            }
          }
        } catch {}
      }

      const proposedAction = JSON.parse(a.proposedAction);

      return {
        id: a.id,
        taskId: a.taskId,
        taskTitle: a.task.title,
        employeeId: a.employeeId,
        employeeName: a.employee.name,
        employeeColor: AVATAR_COLORS[a.employee.name] || "#10b981",
        tool: a.tool,
        toolDisplayName: a.toolDisplayName,
        proposedAction,
        originalAction: a.originalAction ? JSON.parse(a.originalAction) : null,
        status: a.status,
        criticality: a.criticality,
        riskScore: a.riskScore,
        confidence: a.confidence,
        businessImpact: a.businessImpact,
        policyTrigger: a.policyTrigger,
        policyId: a.policyId,
        createdAt: a.createdAt,
        timeoutAt: a.timeoutAt,
        // Execution Contract data (from the step output)
        contract: contractData,
      };
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

const AVATAR_COLORS: Record<string, string> = {
  Saanvi: "#10b981",
  Arjun: "#f59e0b",
  Meera: "#8b5cf6",
  Vikram: "#ec4899",
  Priya: "#64748b",
  Kavya: "#06b6d4",
};

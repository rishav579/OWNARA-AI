import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";
import { resumeAfterApproval } from "@/lib/runtime/executor";
import { createContractVersion } from "@/lib/contracts/engine";
import { recordProfileEvent } from "@/lib/profile/engine";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const { id } = await params;
    const body = await parseBody<{ reason?: string; modifiedAction?: string }>(request);

    const approval = await db.approval.findFirst({ where: { id, workspaceId } });
    if (!approval) return error("NOT_FOUND", "Approval not found.", 404);
    if (approval.status !== "pending") return error("CONFLICT", "Approval is not pending.", 409);

    // ─── Human Override: manager edited the proposed action ────────────────
    // When the manager submits a modified action, we:
    // 1. Preserve the original proposed action on the approval record
    // 2. Create a new contract version (V2, V3, ...) with the modified action
    // 3. Emit a human_override profile event (small trust/accuracy nudge)
    // 4. Then continue with the normal approve flow
    if (body.modifiedAction && body.modifiedAction.trim().length > 0) {
      // Find the current (pending) contract linked to this approval's task
      const gateStep = await db.taskStep.findFirst({
        where: {
          taskId: approval.taskId,
          stepType: "approval_gate",
          status: "pending",
        },
      });

      let contractId: string | null = null;
      if (gateStep?.output) {
        try {
          const out = JSON.parse(gateStep.output);
          if (out.contractId) contractId = out.contractId;
        } catch {}
      }

      if (contractId) {
        // Preserve the original proposed action (only once — first modification)
        if (!approval.originalAction) {
          await db.approval.update({
            where: { id },
            data: { originalAction: approval.proposedAction },
          });
        }

        // Parse the existing proposed action and apply the manager's edit
        // to the body field (the most common override). Other fields are
        // preserved from the parent contract.
        const parentProposed = JSON.parse(approval.proposedAction);
        const mergedProposed = {
          ...parentProposed,
          body: body.modifiedAction,
          modifiedByHuman: true,
        };

        try {
          // createContractVersion marks the parent as superseded and creates V2
          const v2 = await createContractVersion(contractId, {
            proposedAction: mergedProposed,
          });

          // Re-link the gate step's output to point at V2 so the executor
          // approves the correct contract on resume.
          if (gateStep) {
            await db.taskStep.update({
              where: { id: gateStep.id },
              data: {
                output: JSON.stringify({
                  ...JSON.parse(gateStep.output || "{}"),
                  contractId: v2.id,
                  contractVersion: v2.version,
                  modifiedByHuman: true,
                }),
              },
            });
          }

          // Record the human_override profile event (zero approval-level
          // impact — the approval itself is still approved below).
          try {
            await recordProfileEvent({
              type: "human_override",
              employeeId: approval.employeeId,
              workspaceId,
              taskId: approval.taskId,
              toolName: approval.tool,
            });
          } catch (err) {
            console.error(`[Approve] human_override profile event failed for approval ${id}:`, err);
          }
        } catch (err) {
          console.error(`[Approve] Contract V2 creation failed for approval ${id}:`, err);
          // Fall through to the normal approve flow — the modification is
          // best-effort and must not block the manager's approval.
        }
      }
    }

    // ─── Atomic claim (concurrency guard) ────────────────────────────────
    // updateMany with status: "pending" in the WHERE clause is an atomic
    // operation. If two managers approve simultaneously, only one updateMany
    // matches (count === 1) and proceeds to resumeAfterApproval. The other
    // gets count === 0 — the approval was already decided — and returns 409.
    // This prevents duplicate tool execution (e.g. double reminder emails).
    const claimed = await db.approval.updateMany({
      where: { id, workspaceId, status: "pending" },
      data: {
        status: "approved",
        decidedBy: user.id,
        decidedAt: new Date(),
        decision: "approved",
        reason: body.reason || (body.modifiedAction ? `Modified by manager` : null),
      },
    });

    if (claimed.count === 0) {
      return error("CONFLICT", "Approval was already decided by another user.", 409);
    }

    // Resume the task — this marks the approval_gate step as completed,
    // transitions the task back to "executing", and writes audit entries.
    // The worker will pick it up on the next poll and continue.
    await resumeAfterApproval(approval.taskId, id, user.id, user.name);

    return success({
      id,
      status: "approved",
      decision: {
        decision: "approved",
        decidedBy: user.id,
        decidedByName: user.name,
        reason: body.reason || (body.modifiedAction ? "Modified by manager" : null),
        decidedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { reassignMandateTenant } from "@/lib/mandate/engine";

/**
 * POST /api/mandates/[id]/reassign
 *
 * Reassigns the Mandate to a new AI tenant. This is the CENTRAL TEST of the
 * Mandate architecture: the Mandate must survive tenant replacement with its
 * declaration, authority, memory, ledger, outcome history, and lifecycle intact.
 *
 * Body: { newTenantId, reason? }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId, user } = await requireWorkspace(request);
    const { id } = await params;
    const body = await request.json();
    const { newTenantId, reason } = body;

    if (!newTenantId) return error("VALIDATION", "newTenantId is required.", 400);

    // Validate new tenant belongs to workspace
    const tenant = await db.employee.findFirst({ where: { id: newTenantId, workspaceId } });
    if (!tenant) return error("NOT_FOUND", "New tenant not found in this workspace.", 404);

    await reassignMandateTenant(id, newTenantId, user.id, reason);

    // Return the reassigned mandate with preserved context to PROVE survival
    const mandate = await db.mandate.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, role: true } },
        _count: { select: { tasks: true, memory: true } },
      },
    });
    return success({
      ...mandate,
      survived: {
        declaration: mandate?.declaration,
        authoritySpec: mandate?.authoritySpec,
        memoryCount: mandate?._count.memory,
        taskCount: mandate?._count.tasks,
        healthScore: mandate?.healthScore,
        status: mandate?.status,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
